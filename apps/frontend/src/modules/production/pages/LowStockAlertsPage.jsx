import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { AlertTriangle, Factory, RefreshCw, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';

export default function LowStockAlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const fromNotifications = location.state?.from === '/notifications';

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/products/low-stock');
      setAlerts(res.data);
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
    // Navigate to Add Production and pre-fill state: product and recommended quantity
    const recommendedQty = item.minLevel * 2 - item.currentStock; // simple recommendation
    navigate('/production/add', {
      state: {
        productId: item.id,
        quantity: Math.max(10, recommendedQty)
      }
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {fromNotifications && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/notifications')} 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg transition-colors w-fit"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Notifications Center
        </Button>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <AlertTriangle className="w-6 h-6 mr-2 text-rose-500" />
            Low Stock Alerts
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Products that require immediate production scheduling.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAlerts} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Checking stock levels...</div>
        ) : alerts.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">All Stock Levels OK</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">No products are currently below minimum stock levels.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {alerts.map(item => (
              <div key={item.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs text-slate-400">{item.code}</span>
                    <h4 className="font-bold text-slate-900 dark:text-white">{item.name}</h4>
                    <span className={`px-2 py-0.5 text-2xs font-semibold rounded-full ${
                      item.status === 'Critical'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200/50 dark:border-rose-500/20'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 flex items-center space-x-4">
                    <span>Current Stock: <strong className="text-slate-900 dark:text-white">{item.currentStock} {item.unit}</strong></span>
                    <span>•</span>
                    <span>Min Level: <strong>{item.minLevel}</strong></span>
                    <span>•</span>
                    <span>Reorder Point: <strong>{item.reorderPoint}</strong></span>
                  </div>
                </div>
                
                <Button 
                  onClick={() => handleScheduleProduction(item)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 py-2 rounded-xl flex items-center shadow-sm"
                >
                  <Factory className="w-3.5 h-3.5 mr-1.5" />
                  Schedule Production
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
