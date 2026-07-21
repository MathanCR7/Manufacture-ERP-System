import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { Package, Search, AlertTriangle, ArrowRight, RefreshCw, Layers, DollarSign, History, X, Factory, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/Pagination';

export default function ProductStockPage() {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [movements, setMovements] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Pagination State for Main Table
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Pagination State for Stock Ledger Modal
  const [ledgerPage, setLedgerPage] = useState(1);
  const LEDGER_ITEMS_PER_PAGE = 10;

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await api.get('/products/stock');
      setStock(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setLedgerPage(1);
    setShowHistoryModal(true);
    try {
      const res = await api.get('/products/stock/movements');
      setMovements(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, []);

  // Reset main page to 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalValue = stock.reduce((sum, item) => sum + Number(item.totalValue), 0);
  const totalUnits = stock.reduce((sum, item) => sum + Number(item.currentStock), 0);
  const lowStockCount = stock.filter(item => item.status === 'Low').length;
  const criticalStockCount = stock.filter(item => item.status === 'Critical').length;

  const filtered = stock.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Main table pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedStock = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Ledger table pagination
  const totalLedgerPages = Math.ceil(movements.length / LEDGER_ITEMS_PER_PAGE);
  const paginatedLedger = movements.slice(
    (ledgerPage - 1) * LEDGER_ITEMS_PER_PAGE,
    ledgerPage * LEDGER_ITEMS_PER_PAGE
  );

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-205 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <Package className="w-5.5 h-5.5 mr-2 text-indigo-650 shrink-0" />
            Product Stock
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Real-time finished goods inventory and value.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHistory}
            className="flex items-center justify-center gap-1.5 border-slate-202 bg-white dark:bg-slate-900 h-9 text-xs font-bold w-full sm:w-auto"
          >
            <History className="w-3.5 h-3.5" />
            Stock Ledger
          </Button>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search products..." 
              className="pl-9 bg-white dark:bg-slate-950 border border-slate-200 text-xs h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-955/20 text-indigo-650 dark:text-indigo-400 rounded-xl shrink-0">
            <DollarSign className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Goods Value</p>
            <p className="text-base font-black text-slate-805 dark:text-white mt-0.5">₹{totalValue.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-855 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-650 dark:text-emerald-450 rounded-xl shrink-0">
            <Layers className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Stocked Units</p>
            <p className="text-base font-black text-slate-805 dark:text-white mt-0.5">{totalUnits.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-855 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
            <AlertTriangle className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Low Stock Products</p>
            <p className="text-base font-black text-slate-805 dark:text-white mt-0.5">{lowStockCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-855 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-455 rounded-xl shrink-0">
            <AlertTriangle className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Critical Shortfalls</p>
            <p className="text-base font-black text-rose-600 dark:text-rose-455 mt-0.5">{criticalStockCount}</p>
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-550 dark:text-slate-455 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest">
              <tr>
                <th className="px-4 py-3">Product Code</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">In Stock</th>
                <th className="px-4 py-3 text-right">Reproduction Point</th>
                <th className="px-4 py-3 text-right">Min Level</th>
                <th className="px-4 py-3 text-right">Unit Value</th>
                <th className="px-4 py-3 text-right">Total Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">Loading stock details...</td>
                </tr>
              ) : paginatedStock.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">No products found.</td>
                </tr>
              ) : (
                paginatedStock.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      {item.code}
                    </td>
                    <td className="px-4 py-3 font-semibold text-indigo-650 dark:text-indigo-400">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-lg ${
                        item.status === 'OK'
                          ? 'bg-emerald-500/10 text-emerald-650 dark:text-emerald-450 border border-emerald-500/20'
                          : item.status === 'Low'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-455 border border-rose-500/20 animate-pulse'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-950 dark:text-white">
                      {item.currentStock} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-450">
                      {item.reorderPoint}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-450">
                      {item.minLevel}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                      ₹{Number(item.unitValue).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white font-mono">
                      ₹{Number(item.totalValue).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-slate-555 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} entries
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-404 font-medium order-3">
              Total entries: {filtered.length} products
            </div>
          </div>
        )}
      </div>

      {/* Stock Ledger History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-slate-50 dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-205 dark:border-slate-800 text-xs animate__animated animate__zoomIn animate__faster">
            {/* Full Display Indigo Gradient Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white flex justify-between items-center relative shadow-sm">
              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold flex items-center uppercase tracking-wide">
                  <History className="w-5 h-5 mr-2 text-indigo-100" /> Stock Ledger Audit Trail
                </h3>
                <p className="text-[10px] text-indigo-100/90 font-medium">Chronological history of finished product stock movements.</p>
              </div>
              <button 
                onClick={() => setShowHistoryModal(false)} 
                className="p-1.5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {historyLoading ? (
                <div className="py-12 text-center text-slate-400 font-semibold">Loading audit logs...</div>
              ) : movements.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-semibold">No stock movements recorded yet.</div>
              ) : (
                <div className="border border-slate-200/60 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-slate-950">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100/70 dark:bg-slate-950 text-slate-600 dark:text-slate-455 font-bold uppercase tracking-wider border-b border-slate-200/60 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Date & Time</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3">Reference</th>
                        <th className="px-4 py-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {paginatedLedger.map(m => {
                        const isProduction = m.type === 'PRODUCTION_INFLOW';
                        const isSales = m.type === 'SALES_OUTFLOW';
                        
                        return (
                          <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="px-4 py-3 text-slate-550 dark:text-slate-400 font-semibold">
                              {new Date(m.createdAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                              {m.product?.name}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded-lg border ${
                                m.direction === 1
                                  ? 'bg-emerald-500/10 text-emerald-650 dark:text-emerald-450 border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-455 border-rose-500/20'
                              }`}>
                                {isProduction ? (
                                  <Factory className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-450" />
                                ) : isSales ? (
                                  <ShoppingCart className="w-3.5 h-3.5 text-rose-500" />
                                ) : (
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                                )}
                                {m.type.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-right font-black font-mono text-[13px] ${m.direction === 1 ? 'text-emerald-600 dark:text-emerald-450' : 'text-rose-600'}`}>
                              {m.direction === 1 ? '+' : '-'}{m.quantity}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-455 font-bold">
                              {m.batch?.referenceNo || m.order?.referenceNo || 'System'}
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-medium">
                              {m.note}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {/* Ledger Pagination Controls */}
                  {totalLedgerPages > 1 && (
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-3">
                      <div className="text-[11px] text-slate-550 dark:text-slate-400 font-medium">
                        Showing {(ledgerPage - 1) * LEDGER_ITEMS_PER_PAGE + 1} to {Math.min(ledgerPage * LEDGER_ITEMS_PER_PAGE, movements.length)} of {movements.length} entries
                      </div>
                      <Pagination 
                        currentPage={ledgerPage} 
                        totalPages={totalLedgerPages} 
                        onPageChange={setLedgerPage} 
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
