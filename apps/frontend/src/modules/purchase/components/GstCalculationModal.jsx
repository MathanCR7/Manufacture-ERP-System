import React, { useState, useRef, useEffect } from 'react';
import { Info, X, Calculator, Percent } from 'lucide-react';

/**
 * Calculates comprehensive GST breakdown for line items and additional taxable charges
 */
export function calculateGstBreakdown({ items = [], charges = [], isInterState = false }) {
  const rateBlocks = {};

  // 1. Process Line Items
  items.forEach(item => {
    const isTaxable = item.gstApplicable !== false;
    const rate = isTaxable ? Number(item.gstPercentage !== undefined ? item.gstPercentage : 18) : 0;
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    const taxable = parseFloat(item.subtotal) || (qty * price) || 0;
    const gstAmount = isTaxable ? taxable * (rate / 100) : 0;

    if (!rateBlocks[rate]) {
      rateBlocks[rate] = {
        rate,
        items: [],
        charges: [],
        taxable: 0,
        gst: 0
      };
    }

    if (taxable > 0 || isTaxable) {
      rateBlocks[rate].items.push({
        name: item.name || item.code || 'Item',
        description: item.name || item.code || 'Item',
        taxable,
        gstAmount,
        rate
      });
      rateBlocks[rate].taxable += taxable;
      rateBlocks[rate].gst += gstAmount;
    }
  });

  // 2. Process Taxable Charges (Shipping, Other Charges)
  charges.forEach(ch => {
    const isTaxable = ch.applied !== false && ch.gstApplicable !== false;
    const rate = isTaxable ? Number(ch.rate !== undefined ? ch.rate : 18) : 0;
    const taxable = parseFloat(ch.value ?? ch.taxable ?? ch.amount ?? 0) || 0;
    const gstAmount = isTaxable && taxable > 0 ? taxable * (rate / 100) : 0;

    if (taxable > 0) {
      if (!rateBlocks[rate]) {
        rateBlocks[rate] = {
          rate,
          items: [],
          charges: [],
          taxable: 0,
          gst: 0
        };
      }
      rateBlocks[rate].charges.push({
        label: ch.label || 'Charge',
        taxable,
        gstAmount,
        rate
      });
      rateBlocks[rate].taxable += taxable;
      rateBlocks[rate].gst += gstAmount;
    }
  });

  // Sort rate blocks by rate descending (e.g. 28, 18, 12, 5, 0)
  const sortedBlocks = Object.values(rateBlocks)
    .filter(b => b.rate > 0 || b.taxable > 0)
    .sort((a, b) => b.rate - a.rate);

  // Overall sums
  const totalTaxable = sortedBlocks.reduce((sum, b) => sum + b.taxable, 0);
  const totalGst = sortedBlocks.reduce((sum, b) => sum + b.gst, 0);
  const totalCgst = isInterState ? 0 : totalGst / 2;
  const totalSgst = isInterState ? 0 : totalGst / 2;
  const totalIgst = isInterState ? totalGst : 0;

  return {
    sortedBlocks,
    totalTaxable,
    totalGst,
    totalCgst,
    totalSgst,
    totalIgst,
    isInterState
  };
}

/**
 * GST Calculation Info Popover / Tooltip Component
 * Matches the exact executive design in ERP with rate blocks, taxable charges, and line items
 */
export default function GstCalculationModal({
  items = [],
  charges = [],
  isInterState = false,
  breakdownData = null,
  rate = 18,
  triggerClassName = '',
  popoverPlacement = 'bottom'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const breakdown = breakdownData || calculateGstBreakdown({ items, charges, isInterState });
  const activeBlocks = breakdown.sortedBlocks?.length > 0
    ? breakdown.sortedBlocks
    : [{
        rate,
        items: [],
        charges: [],
        taxable: 0,
        gst: 0
      }];

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <span ref={containerRef} className="inline-block relative group/gst">
      {/* (i) Info trigger button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`inline-flex items-center justify-center p-0.5 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 ${triggerClassName}`}
        title="View GST Calculation Details"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {/* Floating Popover: Appears on Hover OR Click */}
      <div
        className={`z-50 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 text-xs text-slate-700 dark:text-slate-300 transition-all duration-200 text-left font-normal select-text ${
          popoverPlacement === 'top'
            ? 'bottom-full mb-2 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2'
            : 'top-full mt-2 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2'
        } ${
          isOpen
            ? 'opacity-100 visible pointer-events-auto block'
            : 'opacity-0 invisible group-hover/gst:opacity-100 group-hover/gst:visible pointer-events-none group-hover/gst:pointer-events-auto absolute'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {activeBlocks.map((blk, blockIdx) => (
          <div key={blk.rate} className={blockIdx > 0 ? 'mt-3 pt-3 border-t border-slate-100 dark:border-slate-800' : ''}>
            {/* Popover Header */}
            <div className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-2 flex justify-between items-center flex-row">
              <span className="flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-indigo-500" />
                <span>GST Calculation Details</span>
              </span>
              <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded text-[10px] font-black border border-indigo-200/50 dark:border-indigo-800/50">
                {blk.rate}% Rate Block
              </span>
            </div>

            {/* Scrollable Items & Charges Area */}
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {/* Line Items */}
              {blk.items.length > 0 && (
                <div>
                  <span className="font-bold text-[10px] uppercase text-indigo-600 dark:text-indigo-400 tracking-wider mb-1 block">
                    Line Items
                  </span>
                  <div className="space-y-1">
                    {blk.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-start border-b border-slate-50 dark:border-slate-800/40 pb-1 text-[11px]">
                        <span className="max-w-[170px] truncate font-medium text-slate-800 dark:text-slate-200" title={it.name}>
                          {it.name}
                        </span>
                        <div className="text-right">
                          <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
                            ₹{it.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-normal">
                            + {isInterState ? `IGST (${blk.rate}%)` : `CGST+SGST (${blk.rate}%)`}: ₹{it.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Taxable Charges (Shipping, Other Charges) */}
              {blk.charges.length > 0 && (
                <div className={blk.items.length > 0 ? 'pt-1.5' : ''}>
                  <span className="font-bold text-[10px] uppercase text-indigo-600 dark:text-indigo-400 tracking-wider mb-1 block">
                    Taxable Charges
                  </span>
                  <div className="space-y-1">
                    {blk.charges.map((ch, idx) => (
                      <div key={idx} className="flex justify-between items-start border-b border-slate-50 dark:border-slate-800/40 pb-1 text-[11px]">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {ch.label}
                        </span>
                        <div className="text-right">
                          <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
                            ₹{ch.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-normal">
                            + GST: ₹{ch.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {blk.items.length === 0 && blk.charges.length === 0 && (
                <p className="text-[11px] text-slate-400 italic py-1">No items or taxable charges at {blk.rate}%.</p>
              )}
            </div>

            {/* Block Subtotals */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-bold text-slate-900 dark:text-white text-xs">
              <span>Total Taxable ({blk.rate}%)</span>
              <span className="font-mono">₹{blk.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            <div className="mt-1 flex justify-between font-bold text-indigo-600 dark:text-indigo-400 text-xs">
              <span>Total GST ({blk.rate}%)</span>
              <span className="font-mono">₹{blk.gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        ))}

        {/* Global CGST / SGST split for all rate blocks */}
        {!isInterState ? (
          <div className="mt-2.5 pt-2 border-t border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-2 rounded-xl space-y-1 text-[11px]">
            <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
              <span>Total CGST (50%):</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                ₹{breakdown.totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
              <span>Total SGST (50%):</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                ₹{breakdown.totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-2.5 pt-2 border-t border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-2 rounded-xl text-[11px] flex justify-between font-semibold text-slate-700 dark:text-slate-300">
            <span>Total IGST (Interstate):</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              ₹{breakdown.totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>
    </span>
  );
}
