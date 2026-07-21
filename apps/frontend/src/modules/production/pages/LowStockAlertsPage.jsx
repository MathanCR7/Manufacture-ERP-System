import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { AlertTriangle, Factory, RefreshCw, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { Pagination } from '@/components/ui/Pagination';

export default function LowStockAlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const fromNotifications = location.state?.from === '/notifications';

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchAlerts = async () => {
    setLoading(true);
    setCurrentPage(1);
    try {
      const res = await api.get('/products/low-stock');
      setAlerts(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleScheduleProduction = (item) => {
    const recommendedQty = item.minLevel * 2 - item.currentStock; // simple recommendation
    navigate('/production/add', {
      state: {
        productId: item.id,
        quantity: Math.max(10, recommendedQty)
      }
    });
  };

  // Pagination calculations
  const totalPages = Math.ceil(alerts.length / ITEMS_PER_PAGE);
  const paginatedAlerts = alerts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {fromNotifications && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/notifications')} 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg transition-colors w-fit h-8"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Notifications Center
        </Button>
      )}
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-205 dark:border-slate-805">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <AlertTriangle className="w-5.5 h-5.5 mr-2 text-rose-500 shrink-0" />
            Reproduction Alerts
          </h1>
          <p className="text-xs text-slate-550 dark:text-slate-400 mt-0.5">
            Finished goods below minimum level or reproduction point.
          </p>
        </div>
      </div>

      {/* Main Alerts List Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden text-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Checking stock levels...</div>
        ) : alerts.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">All Stock Levels OK</h3>
            <p className="text-xs text-slate-550 dark:text-slate-400 mt-1">No products are currently below minimum stock or reproduction levels.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedAlerts.map(item => (
                <div key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-all duration-150">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-3xs font-bold text-slate-400">{item.code}</span>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</h4>
                      <span className={`px-2 py-0.5 text-3xs font-bold rounded-full ${
                        item.status === 'Critical'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-455 border border-rose-500/20 animate-pulse'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center space-x-3 font-semibold">
                      <span>Current Stock: <strong className="text-slate-900 dark:text-white">{item.currentStock} {item.unit}</strong></span>
                      <span>•</span>
                      <span>Min Level: <strong className="text-slate-700 dark:text-slate-300">{item.minLevel}</strong></span>
                      <span>•</span>
                      <span>Reproduction Point: <strong className="text-slate-700 dark:text-slate-300">{item.reorderPoint}</strong></span>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => handleScheduleProduction(item)}
                    className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center shadow-xs cursor-pointer h-9"
                  >
                    <Factory className="w-3.5 h-3.5 mr-1.5" />
                    Schedule Production
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Footer info & Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="text-[11px] text-slate-555 dark:text-slate-400 font-medium order-2 sm:order-1">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, alerts.length)} of {alerts.length} alerts
                </div>

                <div className="order-1 sm:order-2">
                  <Pagination 
                    currentPage={currentPage} 
                    totalPages={totalPages} 
                    onPageChange={setCurrentPage} 
                  />
                </div>

                <div className="text-xs text-slate-404 font-medium order-3">
                  Total entries: {alerts.length} records
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
