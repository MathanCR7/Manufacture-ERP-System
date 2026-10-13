import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { AlertTriangle, Search, ChevronLeft, Clock, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { SortSelect } from '@/components/ui/SortSelect';
import { Pagination } from '@/components/ui/Pagination';
import DashboardBackButton from '@/components/ui/DashboardBackButton';
import RMHistoryDrawer from '@/modules/purchase/components/RMHistoryDrawer';

export default function RMLowStockPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const fromNotifications = location.state?.from === '/notifications';

  // History Drawer State
  const [selectedMaterialId, setSelectedMaterialId] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

  const handleOpenHistory = (materialId) => {
    setSelectedMaterialId(materialId);
    setIsHistoryOpen(true);
  };

  const handleCloseHistory = () => {
    setIsHistoryOpen(false);
    setSelectedMaterialId(null);
  };

  const handleExportLowStockExcel = () => {
    if (!sortedStock || sortedStock.length === 0) return;
    const exportData = sortedStock.map((item, idx) => ({
      'SN': idx + 1,
      'Material Code': item.code,
      'Material Name': item.name,
      'Reorder Level': item.alertLevel,
      'Available Quantity': item.availableQuantity,
      'Unit': item.unit,
      'Rate Per Unit (INR)': item.ratePerUnit,
      'Total Value (INR)': item.value,
      'Stock Shortfall': Math.max(0, item.alertLevel - item.availableQuantity),
      'Deficit Status': 'CRITICAL LOW STOCK'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Low Stock RM Alerts');
    const dateStamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `RM_Low_Stock_Alerts_${dateStamp}.xlsx`);
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
      <DashboardBackButton />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-850">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-455 flex items-center">
            <AlertTriangle className="w-5.5 h-5.5 mr-2 shrink-0 animate-pulse text-rose-600" />
            Low Stock Alerts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Items that have reached or fallen below their reorder levels. Click any item or &quot;History&quot; to inspect full lifecycle.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportLowStockExcel}
            className="flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 h-9 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Export Excel</span>
          </Button>
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
        {/* Mobile & Tablet Responsive View (NO Horizontal Scroll, Displays All Data) */}
        <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Loading stock data...</div>
          ) : paginatedStock.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No items are currently in low stock.</div>
          ) : (
            paginatedStock.map((item, idx) => {
              const calculatedIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
              const shortfall = Math.max(0, item.alertLevel - item.availableQuantity);

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenHistory(item.id)}
                  className="p-3.5 space-y-2.5 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
                >
                  {/* Top Row: #SN + Code + Material Name + Deficit Alert Tag */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-bold font-mono">
                        #{calculatedIndex}
                      </span>
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] font-mono font-bold border dark:border-slate-700">
                        {item.code}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-extrabold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      CRITICAL DEFICIT
                    </span>
                  </div>

                  {/* Material Name */}
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight">
                    {item.name}
                  </div>

                  {/* 2-Column Quantity & Reorder Subgrid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/40">
                      <span className="text-[9px] uppercase font-bold text-rose-700 dark:text-rose-400 block">
                        Available Qty
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">
                          {item.availableQuantity.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-rose-500 uppercase font-semibold">
                          {item.unit}
                        </span>
                      </div>
                      {shortfall > 0 && (
                        <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                          Shortfall: -{shortfall.toLocaleString()} {item.unit}
                        </div>
                      )}
                    </div>

                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">
                        Reorder Level
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-sm">
                          {item.alertLevel.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          {item.unit}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Threshold Alert
                      </div>
                    </div>
                  </div>

                  {/* Rates & Valuation Subgrid */}
                  <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Rate Per Unit:</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        ₹{item.ratePerUnit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Total Value (INR):</span>
                      <span className="font-mono font-black text-slate-900 dark:text-white">
                        ₹{item.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* History Action Button */}
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenHistory(item.id);
                      }}
                      title="View Material Lifecycle & Audit History"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition-all cursor-pointer shadow-xs"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Audit History</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (ONLY on screens lg and larger >= 1024px) */}
        <div className="hidden lg:block overflow-x-auto">
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
                <th className="px-4 py-2.5 text-center w-28">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    Loading stock data...
                  </td>
                </tr>
              ) : paginatedStock.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    No items are currently in low stock.
                  </td>
                </tr>
              ) : (
                paginatedStock.map((item, idx) => {
                  const calculatedIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => handleOpenHistory(item.id)}
                      className="hover:bg-rose-50/40 dark:hover:bg-rose-950/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none cursor-pointer group"
                    >
                      <td className="px-4 py-2.5 text-center text-slate-400 font-semibold">{calculatedIndex}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-905 dark:text-white">
                        <div className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] inline-block border dark:border-slate-750 group-hover:border-rose-300 dark:group-hover:border-rose-700 transition-colors">
                          {item.code}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-indigo-650 dark:text-indigo-400 group-hover:underline">{item.name}</td>
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
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenHistory(item.id);
                          }}
                          title="View Material Lifecycle & Audit History"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition-all cursor-pointer shadow-xs"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>History</span>
                        </button>
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

      {/* RM History Drawer */}
      <RMHistoryDrawer
        materialId={selectedMaterialId}
        isOpen={isHistoryOpen}
        onClose={handleCloseHistory}
      />
    </div>
  );
}
