import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Package, Search, AlertTriangle, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SortSelect } from '@/components/ui/SortSelect';
import { Pagination } from '@/components/ui/Pagination';

export default function RMStockPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const queryClient = useQueryClient();

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const { data: stock = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['rm-stock'],
    queryFn: async () => {
      const response = await api.get('/rm-stock');
      setLastRefreshed(new Date());
      return response.data;
    },
    refetchOnMount: 'always',       // always hit the server when navigating to this page
    refetchOnWindowFocus: true,     // refetch when user switches back to the tab
    staleTime: 0,                   // never treat data as fresh — always revalidate
  });

  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['rm-stock'] });
    refetch();
  };

  const [sortBy, setSortBy] = useState('name_asc');
  const sortOptions = [
    { value: 'name_asc', label: 'Material: A to Z' },
    { value: 'name_desc', label: 'Material: Z to A' },
    { value: 'quantity_desc', label: 'Qty: High to Low' },
    { value: 'quantity_asc', label: 'Qty: Low to High' },
    { value: 'value_desc', label: 'Value: High to Low' },
    { value: 'value_asc', label: 'Value: Low to High' },
  ];

  // Reset pagination to first page when search/sort parameters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  const filteredStock = stock.filter(item => 
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
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <Package className="w-5.5 h-5.5 mr-2 text-indigo-650 shrink-0" />
            Raw Material Stock
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage and monitor your raw material inventory.
            <span className="ml-2 text-3xs text-slate-455 dark:text-slate-500 font-mono">
              Last synced: {lastRefreshed.toLocaleTimeString()}
            </span>
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isFetching}
            className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-450 h-9 rounded-xl border-slate-205 dark:border-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-405" />
            <Input 
              placeholder="Search by code or name..." 
              className="pl-9 h-9 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 w-full text-xs"
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

      {/* Main Stock Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-slate-550 dark:text-slate-450 font-bold border-b border-slate-100 dark:border-slate-800 uppercase tracking-widest">
              <tr>
                <th className="px-4 py-2.5 w-14 text-center">SN</th>
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Material Name</th>
                <th className="px-4 py-2.5">Available Quantity</th>
                <th className="px-4 py-2.5">Floating Stock</th>
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
                    No stock found matching your search.
                  </td>
                </tr>
              ) : (
                paginatedStock.map((item, idx) => {
                  const calculatedIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                  const isLowStock = item.availableQuantity <= item.alertLevel;
                  return (
                    <tr key={item.id} className="hover:bg-slate-55/40 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                      <td className="px-4 py-2.5 text-center text-slate-400 font-semibold">{calculatedIndex}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] inline-block border dark:border-slate-750">
                          {item.code}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-indigo-650 dark:text-indigo-400">{item.name}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center space-x-1.5">
                          <span className={`font-black ${isLowStock ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                            {item.availableQuantity.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">{item.unit}</span>
                          {isLowStock && (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" title="Low Stock Alert" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-slate-900 dark:text-white">{item.floatingStock.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-500 uppercase ml-1 font-semibold">{item.unit}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-900 dark:text-white">
                        <span className="text-[10px] text-slate-400 mr-0.5 font-sans">₹</span>
                        {item.ratePerUnit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-right font-black text-slate-905 dark:text-white">
                        <span className="text-[10px] text-slate-400 mr-0.5 font-sans">₹</span>
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
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sortedStock.length)} of {sortedStock.length} materials
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
