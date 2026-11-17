import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Snowflake, PackageCheck, Layers, ArrowUpRight } from 'lucide-react';
import FioriCard from './FioriCard';
import { FioriSkeleton, FioriErrorRetry } from './FioriStateHandlers';

export default function FinishedGoodsPanel({
  fgData,
  finishedGoods,
  expiryData = {},
  isLoading,
  isError,
  error,
  onRetry,
  updatedAt
}) {
  const navigate = useNavigate();
  const fg = fgData || finishedGoods || {};

  const totalStock = fg.totalFinishedGoodsStock || 0;
  const coldCartons = fg.coldRoomCartons || 0;
  const directStock = fg.directToStockCount || 0;
  const qcHold = fg.qcHoldCount || 0;

  const under7 = expiryData.under7Days || 0;
  const days8to30 = expiryData.days8to30 || 0;
  const over30 = expiryData.over30Days || 0;

  const watchlist = Array.isArray(expiryData?.watchlist)
    ? expiryData.watchlist
    : Array.isArray(expiryData)
    ? expiryData
    : [];

  return (
    <FioriCard
      eyebrow="Cold Room & Lot Storage"
      title="Finished Goods & FIFO Expiry"
      icon={Snowflake}
      redirectRoute="/products/stock"
      action={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate('/products/stock')}
            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 hover:bg-blue-100 text-[#0A6ED1] dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer flex items-center gap-1"
            title="Open Finished Products Stock Ledger (/products/stock)"
          >
            <span>/products/stock</span>
            <ArrowUpRight className="w-2.5 h-2.5 opacity-70" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/setup/product')}
            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
            title="Open Finished Products Master Setup (/setup/product)"
          >
            <span>/setup/product</span>
            <ArrowUpRight className="w-2.5 h-2.5 opacity-70" />
          </button>
        </div>
      }
      updatedAt={updatedAt}
    >
      {isLoading ? (
        <FioriSkeleton rows={5} height="h-72" />
      ) : error ? (
        <FioriErrorRetry error={error} onRetry={onRetry} />
      ) : (
        <div className="flex-1 flex flex-col justify-between space-y-3">
          {/* Top Metric Cards Row */}
          <div className="grid grid-cols-2 gap-2 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/80">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total FG Available Stock
              </div>
              <div className="text-base sm:text-lg font-mono font-black text-slate-900 dark:text-slate-100">
                {totalStock.toLocaleString('en-IN')}{' '}
                <span className="text-[11px] font-normal text-slate-500">pcs/units</span>
              </div>
              <div className="text-[10px] text-slate-400">≈ {coldCartons} cold room cartons</div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Stock Routing Split
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono font-bold text-[#107E3E] dark:text-emerald-400">
                  {directStock} Direct Stock
                </span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span className="text-xs font-mono font-bold text-[#A65800] dark:text-amber-400">
                  {qcHold} QC Hold
                </span>
              </div>
              <div className="text-[10px] text-slate-400">Tested batches released to trade</div>
            </div>
          </div>

          {/* FIFO Expiry Buckets */}
          <div>
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span>FIFO Expiry Horizon</span>
              <span className="text-[10px] text-slate-400">Perishability clearance</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="p-1.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                <div className="text-[9.5px] font-bold uppercase text-rose-800 dark:text-rose-300">&lt; 7 Days</div>
                <div className="font-mono text-sm font-black text-rose-700 dark:text-rose-400">{under7} lots</div>
              </div>

              <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                <div className="text-[9.5px] font-bold uppercase text-amber-800 dark:text-amber-300">8 - 30 Days</div>
                <div className="font-mono text-sm font-black text-amber-700 dark:text-amber-400">{days8to30} lots</div>
              </div>

              <div className="p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                <div className="text-[9.5px] font-bold uppercase text-emerald-800 dark:text-emerald-300">&gt; 30 Days</div>
                <div className="font-mono text-sm font-black text-[#107E3E] dark:text-emerald-400">{over30} lots</div>
              </div>
            </div>
          </div>

          {/* Expiry Watchlist Table with Push to Sales for Finished Products */}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap" aria-label="Approaching Expiry Products">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/80 text-[10px] font-bold text-slate-500 uppercase">
                  <th className="py-1 px-1">Lot / Batch</th>
                  <th className="py-1 px-1">Product / Flavor</th>
                  <th className="py-1 px-1">Days Left</th>
                  <th className="py-1 px-1">Qty</th>
                  <th className="py-1 px-1 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {watchlist.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-xs text-slate-400">
                      No finished product batches approaching expiry.
                    </td>
                  </tr>
                ) : (
                  watchlist.slice(0, 5).map((lot) => {
                    const productName = lot.productName || lot.materialName || lot.name || 'Finished Product';
                    const productCode = lot.productCode || lot.code;
                    const lotBatch = lot.lotNumber || lot.batchNo || 'LOT-GENERAL';
                    const daysRemaining = Number(lot.daysRemaining !== undefined ? lot.daysRemaining : 0);
                    const qty = Number(lot.quantity !== undefined ? lot.quantity : 0);
                    const unit = lot.unit || 'pcs';

                    return (
                      <tr key={lot.id || lotBatch} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td
                          className="py-1.5 px-1 font-mono text-[11px] font-bold text-[#0A6ED1] dark:text-blue-400 truncate max-w-[110px]"
                          title={lotBatch}
                        >
                          {lotBatch}
                        </td>
                        <td
                          className="py-1.5 px-1 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[130px]"
                          title={`${productName}${productCode ? ` (${productCode})` : ''}`}
                        >
                          <div className="flex flex-col leading-tight">
                            <span className="truncate">{productName}</span>
                            {productCode && (
                              <span className="text-[9.5px] font-mono text-slate-400 dark:text-slate-500">
                                {productCode}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-1 font-mono text-[11px] font-black">
                          <span
                            className={
                              daysRemaining <= 7
                                ? 'text-rose-600 dark:text-rose-400'
                                : daysRemaining <= 30
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }
                          >
                            {daysRemaining}d
                          </span>
                        </td>
                        <td className="py-1.5 px-1 font-mono text-slate-700 dark:text-slate-300">
                          {qty.toLocaleString('en-IN')}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">{unit}</span>
                        </td>
                        <td className="py-1.5 px-1 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const params = new URLSearchParams();
                              if (lot.productId) params.set('productId', lot.productId);
                              if (productName) params.set('productName', productName);
                              if (lotBatch) params.set('batchNo', lotBatch);
                              if (qty) params.set('qty', String(qty));
                              navigate(`/sales/order?${params.toString()}`);
                            }}
                            className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 dark:bg-emerald-950 dark:border-emerald-700 text-[#107E3E] dark:text-emerald-300 text-[10px] font-bold cursor-pointer transition-colors shadow-xs"
                            title={`Push ${productName} directly to Sales Order dispatch`}
                          >
                            Push to Sales
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FioriCard>
  );
}
