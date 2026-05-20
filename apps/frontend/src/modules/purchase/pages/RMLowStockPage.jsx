import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { AlertTriangle, Search, ChevronLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate, useLocation } from 'react-router-dom';

export default function RMLowStockPage() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const fromNotifications = location.state?.from === '/notifications';

  const { data: stock = [], isLoading } = useQuery({
    queryKey: ['rm-stock'],
    queryFn: async () => {
      const response = await api.get('/rm-stock');
      return response.data;
    }
  });

  const lowStock = stock.filter(item => item.availableQuantity <= item.alertLevel);
  const filteredStock = lowStock.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {fromNotifications && (
        <button 
          onClick={() => navigate('/notifications')} 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg transition-colors w-fit"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Notifications Center
        </button>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400 flex items-center">
            <AlertTriangle className="w-6 h-6 mr-2" />
            Low Stock Alerts
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Items that have reached or fallen below their reorder levels.</p>
        </div>
        
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by code or name..." 
              className="pl-9 bg-white dark:bg-slate-900"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 font-medium border-b border-red-100 dark:border-red-900/50">
              <tr>
                <th className="px-6 py-4 w-16 text-center">SN</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Material Name</th>
                <th className="px-6 py-4">Reorder Level</th>
                <th className="px-6 py-4">Available Quantity</th>
                <th className="px-6 py-4 text-right">Rate Per Unit</th>
                <th className="px-6 py-4 text-right">Value (In INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    Loading stock data...
                  </td>
                </tr>
              ) : filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No items are currently in low stock.
                  </td>
                </tr>
              ) : (
                filteredStock.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4 text-center text-slate-500">{index + 1}</td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      <div className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs inline-block">
                        {item.code}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-indigo-600 dark:text-indigo-400">{item.name}</td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{item.alertLevel}</span>
                      <span className="text-xs text-slate-500 uppercase ml-1">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {item.availableQuantity}
                        </span>
                        <span className="text-xs text-red-500/70 uppercase">{item.unit}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-slate-500">₹</span>
                      <span className="font-medium text-slate-900 dark:text-white ml-1">
                        {item.ratePerUnit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-slate-500">₹</span>
                      <span className="font-semibold text-slate-900 dark:text-white ml-1">
                        {item.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
