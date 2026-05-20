import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { Package, Search, AlertTriangle, ArrowRight, RefreshCw, Layers, DollarSign, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProductStockPage() {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [movements, setMovements] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await api.get('/products/stock');
      setStock(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setShowHistoryModal(true);
    try {
      // Fetch movement logs from backend
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

  const totalValue = stock.reduce((sum, item) => sum + Number(item.totalValue), 0);
  const totalUnits = stock.reduce((sum, item) => sum + Number(item.currentStock), 0);
  const lowStockCount = stock.filter(item => item.status === 'Low').length;
  const criticalStockCount = stock.filter(item => item.status === 'Critical').length;

  const filtered = stock.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <Package className="w-6 h-6 mr-2 text-indigo-600" />
            Product Stock
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time finished goods inventory and value.
          </p>
        </div>
        
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStock}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHistory}
            className="flex items-center gap-1.5"
          >
            <History className="w-3.5 h-3.5" />
            Stock Ledger
          </Button>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search products..." 
              className="pl-9 bg-white dark:bg-slate-900"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Total Goods Value</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">₹{totalValue.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Total Stocked Units</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{totalUnits.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Low Stock Products</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{lowStockCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">Critical Shortfalls</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white text-rose-600 dark:text-rose-400">{criticalStockCount}</p>
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Product Code</th>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">In Stock</th>
                <th className="px-6 py-4 text-right">Reorder Point</th>
                <th className="px-6 py-4 text-right">Min Level</th>
                <th className="px-6 py-4 text-right">Unit Value</th>
                <th className="px-6 py-4 text-right">Total Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">Loading stock details...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">No products found.</td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-white">
                      {item.code}
                    </td>
                    <td className="px-6 py-4 font-semibold text-indigo-600 dark:text-indigo-400">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        item.status === 'OK'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : item.status === 'Low'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-950 dark:text-white">
                      {item.currentStock} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      {item.reorderPoint}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      {item.minLevel}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900 dark:text-white">
                      ₹{Number(item.unitValue).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                      ₹{Number(item.totalValue).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Ledger History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                  <History className="w-5 h-5 mr-2 text-indigo-500" /> Stock Ledger Audit Trail
                </h3>
                <p className="text-xs text-slate-500">Chronological history of finished product stock movements.</p>
              </div>
              <Button variant="ghost" onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">Close</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {historyLoading ? (
                <div className="py-12 text-center text-slate-400">Loading audit logs...</div>
              ) : movements.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No stock movements recorded yet.</div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/40">
                    <tr>
                      <th className="px-4 py-3">Date & Time</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {movements.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          {m.product.name}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            m.direction === 1
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10'
                          }`}>
                            {m.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${m.direction === 1 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {m.direction === 1 ? '+' : '-'}{m.quantity}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {m.batch?.referenceNo || m.order?.referenceNo || 'System'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {m.note}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
