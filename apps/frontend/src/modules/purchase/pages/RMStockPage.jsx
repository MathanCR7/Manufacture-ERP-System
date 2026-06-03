import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Package, Search, AlertTriangle, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SortSelect } from '@/components/ui/SortSelect';

export default function RMStockPage() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [lastRefreshed, setLastRefreshed] = React.useState(new Date());
  const queryClient = useQueryClient();

  const { data: stock = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['rm-stock'],
    queryFn: async () => {
      const response = await api.get('/rm-stock', {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <Package className="w-6 h-6 mr-2 text-indigo-600" />
            RM Stock
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage and monitor your raw material inventory.
            <span className="ml-2 text-xs text-slate-400">
              Last updated: {lastRefreshed.toLocaleTimeString()}
            </span>
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isFetching}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-slate-655 dark:text-slate-400 h-9 rounded-xl border-slate-200 dark:border-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by code or name..." 
              className="pl-9 h-9 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <SortSelect
            value={sortBy}
            onChange={setSortBy}
            options={sortOptions}
            className="w-full sm:w-auto"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 w-16 text-center">SN</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Material Name</th>
                <th className="px-6 py-4">Available Quantity</th>
                <th className="px-6 py-4">Floating Stock</th>
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
              ) : sortedStock.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No stock found matching your search.
                  </td>
                </tr>
              ) : (
                sortedStock.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4 text-center text-slate-500">{index + 1}</td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      <div className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs inline-block">
                        {item.code}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-indigo-600 dark:text-indigo-400">{item.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className={`font-semibold ${item.availableQuantity <= item.alertLevel ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                          {item.availableQuantity}
                        </span>
                        <span className="text-xs text-slate-500 uppercase">{item.unit}</span>
                        {item.availableQuantity <= item.alertLevel && (
                          <AlertTriangle className="w-4 h-4 text-red-500" title="Low Stock" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-900 dark:text-white">{item.floatingStock}</span>
                      <span className="text-xs text-slate-500 uppercase ml-1">{item.unit}</span>
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
