import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { AlertTriangle, Search, ChevronLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate, useLocation } from 'react-router-dom';
import { SortSelect } from '@/components/ui/SortSelect';
import { Pagination } from '@/components/ui/Pagination';

export default function RMLowStockPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const fromNotifications = location.state?.from === '/notifications';

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const { data: stock = [], isLoading } = useQuery({
    queryKey: ['rm-stock'],
    queryFn: async () => {
      const response = await api.get('/rm-stock');
      return response.data;
    }
  });

  const [sortBy, setSortBy] = useState('name_asc');
  const sortOptions = [
    { value: 'name_asc', label: 'Material: A to Z' },
    { value: 'name_desc', label: 'Material: Z to A' },
    { value: 'quantity_desc', label: 'Qty: High to Low' },
    { value: 'quantity_asc', label: 'Qty: Low to High' },
    { value: 'value_desc', label: 'Value: High to Low' },
    { value: 'value_asc', label: 'Value: Low to High' },
  ];

  // Reset pagination when search query or sorting option changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  const lowStock = stock.filter(item => item.availableQuantity <= item.alertLevel);
  const filteredStock = lowStock.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedStock = [...filteredStock].sort((a, b) => {
    if (sortBy === 'name_asc') {
      return (a.name || '').localeCompare(b.name || '');
    }
    if (sortBy === 'name_desc') {
      return (b.name || '').localeCompare(a.name || '');
    }
    if (sortBy === 'quantity_desc') {
      return Number(b.availableQuantity || 0) - Number(a.availableQuantity || 0);
    }
    if (sortBy === 'quantity_asc') {
      return Number(a.availableQuantity || 0) - Number(b.availableQuantity || 0);
    }
    if (sortBy === 'value_desc') {
      return Number(b.value || 0) - Number(a.value || 0);
    }
    if (sortBy === 'value_asc') {
      return Number(a.value || 0) - Number(b.value || 0);
    }
    return 0;
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedStock.length / ITEMS_PER_PAGE);
  const paginatedStock = sortedStock.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {fromNotifications && (
        <button 
          onClick={() => navigate('/notifications')} 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg transition-colors w-fit h-8"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Notifications Center
        </button>
      )}
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-850">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-455 flex items-center">
            <AlertTriangle className="w-5.5 h-5.5 mr-2 shrink-0 animate-pulse text-rose-600" />
            Low Stock Alerts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Items that have reached or fallen below their reorder levels.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto justify-end">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by code or name..." 
              className="pl-9 h-9 rounded-xl bg-white dark:bg-slate-950 border-slate-205 dark:border-slate-800 w-full text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <SortSelect
            value={sortBy}
            onChange={setSortBy}
            options={sortOptions}
            className="w-full sm:w-auto h-9 text-xs rounded-xl border-slate-200 dark:border-slate-800"
          />
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-rose-50/70 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 font-bold border-b border-rose-100 dark:border-rose-900/50 uppercase tracking-widest">
              <tr>
                <th className="px-4 py-2.5 w-14 text-center">SN</th>
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Material Name</th>
                <th className="px-4 py-2.5">Reorder Level</th>
                <th className="px-4 py-2.5">Available Quantity</th>
                <th className="px-4 py-2.5 text-right">Rate Per Unit</th>
                <th className="px-4 py-2.5 text-right">Value (In INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    Loading stock data...
                  </td>
                </tr>
              ) : paginatedStock.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    No items are currently in low stock.
                  </td>
                </tr>
              ) : (
                paginatedStock.map((item, idx) => {
                  const calculatedIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                      <td className="px-4 py-2.5 text-center text-slate-400 font-semibold">{calculatedIndex}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-905 dark:text-white">
                        <div className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] inline-block border dark:border-slate-750">
                          {item.code}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-indigo-650 dark:text-indigo-400">{item.name}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{item.alertLevel.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-500 uppercase ml-1 font-semibold">{item.unit}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-rose-600 dark:text-rose-400">
                            {item.availableQuantity.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-rose-500/70 uppercase font-semibold">{item.unit}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900 dark:text-white">
                        <span className="text-[10px] text-slate-400 mr-0.5">₹</span>
                        {item.ratePerUnit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-right font-black text-slate-900 dark:text-white">
                        <span className="text-[10px] text-slate-400 mr-0.5">₹</span>
                        {item.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sortedStock.length)} of {sortedStock.length} items
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-400 font-medium order-3">
              Matched entries: {sortedStock.length} materials
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
