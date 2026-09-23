import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Edit, 
  Trash2, 
  Plus, 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ChevronDown, 
  RotateCcw, 
  X, 
  Building2 
} from 'lucide-react';
import { api } from '@/lib/axios';

import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import AddSupplierPage from './AddSupplierPage';
import { Pagination } from '@/components/ui/Pagination';

export default function SupplierListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState({ type: 'list', prefill: null });

  useEffect(() => {
    if (location.pathname === '/parties/suppliers/add' || location.pathname.startsWith('/parties/suppliers/edit/') || location.state) {
      setView({ type: 'create', prefill: location.state });
    } else {
      setView({ type: 'list', prefill: null });
    }
  }, [location]);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceTypeFilter, setBalanceTypeFilter] = useState('ALL'); // ALL | CREDIT | DEBIT
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | ACTIVE | INACTIVE
  const [sortBy, setSortBy] = useState('name_asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await api.get('/parties/suppliers');
      return response.data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/parties/suppliers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    }
  });

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      deleteMutation.mutate(id);
    }
  };

  // Filter and Sort Logic
  const sortedAndFiltered = useMemo(() => {
    let result = (suppliers || []).filter(s => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || (
        (s.name || '').toLowerCase().includes(term) ||
        (s.contactPerson || '').toLowerCase().includes(term) ||
        (s.phone || '').toLowerCase().includes(term) ||
        (s.email || '').toLowerCase().includes(term) ||
        (s.gstin || '').toLowerCase().includes(term) ||
        (s.pan || '').toLowerCase().includes(term) ||
        (s.address || '').toLowerCase().includes(term)
      );

      const matchesBalanceType = balanceTypeFilter === 'ALL' || s.balanceType === balanceTypeFilter;
      const matchesStatus = statusFilter === 'ALL' || (s.status || 'ACTIVE') === statusFilter;

      return matchesSearch && matchesBalanceType && matchesStatus;
    });

    result.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'contact_asc') {
        return (a.contactPerson || '').localeCompare(b.contactPerson || '', undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'contact_desc') {
        return (b.contactPerson || '').localeCompare(a.contactPerson || '', undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'phone_asc') {
        return (a.phone || '').localeCompare(b.phone || '', undefined, { numeric: true });
      }
      if (sortBy === 'phone_desc') {
        return (b.phone || '').localeCompare(a.phone || '', undefined, { numeric: true });
      }
      if (sortBy === 'latest') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }
      if (sortBy === 'credit_desc') {
        return (parseFloat(b.creditLimit) || 0) - (parseFloat(a.creditLimit) || 0);
      }
      if (sortBy === 'credit_asc') {
        return (parseFloat(a.creditLimit) || 0) - (parseFloat(b.creditLimit) || 0);
      }
      if (sortBy === 'balance_desc') {
        return (parseFloat(b.openingBalance) || 0) - (parseFloat(a.openingBalance) || 0);
      }
      if (sortBy === 'balance_asc') {
        return (parseFloat(a.openingBalance) || 0) - (parseFloat(b.openingBalance) || 0);
      }
      if (sortBy === 'balance_type') {
        return (a.balanceType || '').localeCompare(b.balanceType || '');
      }
      return 0;
    });

    return result;
  }, [suppliers, searchTerm, balanceTypeFilter, statusFilter, sortBy]);

  const totalPages = Math.ceil(sortedAndFiltered.length / itemsPerPage) || 1;
  const paginatedSuppliers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAndFiltered.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAndFiltered, currentPage, itemsPerPage]);

  // Clickable header sort helpers
  const handleToggleSortName = () => {
    setSortBy(prev => (prev === 'name_asc' ? 'name_desc' : 'name_asc'));
    setCurrentPage(1);
  };

  const handleToggleSortContact = () => {
    setSortBy(prev => (prev === 'contact_asc' ? 'contact_desc' : 'contact_asc'));
    setCurrentPage(1);
  };

  const handleToggleSortPhone = () => {
    setSortBy(prev => (prev === 'phone_asc' ? 'phone_desc' : 'phone_asc'));
    setCurrentPage(1);
  };

  const handleToggleSortCredit = () => {
    setSortBy(prev => (prev === 'credit_desc' ? 'credit_asc' : 'credit_desc'));
    setCurrentPage(1);
  };

  const handleToggleSortBalance = () => {
    setSortBy(prev => (prev === 'balance_desc' ? 'balance_asc' : 'balance_desc'));
    setCurrentPage(1);
  };

  const handleToggleSortType = () => {
    setSortBy(prev => (prev === 'balance_type' ? 'name_asc' : 'balance_type'));
    setCurrentPage(1);
  };

  const isFilterActive = searchTerm !== '' || balanceTypeFilter !== 'ALL' || statusFilter !== 'ALL' || sortBy !== 'name_asc';

  const handleResetFilters = () => {
    setSearchTerm('');
    setBalanceTypeFilter('ALL');
    setStatusFilter('ALL');
    setSortBy('name_asc');
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-full px-3 sm:px-4 py-2.5 space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      </div>
    );
  }

  if (view.type === 'create') {
    return <AddSupplierPage />;
  }

  return (
    <div className="w-full max-w-full px-3 sm:px-4 py-2.5 space-y-2.5 mx-auto transition-all duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800 shadow-3xs shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Suppliers
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                {suppliers.length} {suppliers.length === 1 ? 'Supplier' : 'Suppliers'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Manage and audit external raw material vendor accounts, GST credentials, and credit limits.
            </p>
          </div>
        </div>

        <Link 
          to="/parties/suppliers/add"
          className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-3xs transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Supplier
        </Link>
      </div>
      
      {/* Main Table Card */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden flex flex-col text-xs">
        <CardContent className="p-0">
          {/* Integrated Pro Toolbar */}
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
            {/* Search Input with quick clear */}
            <div className="relative w-full md:w-64 lg:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search name, contact, phone, GSTIN, address..." 
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 pl-8 pr-7 text-xs border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all shadow-3xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter and Sort Controls */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
              {searchTerm && (
                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium hidden lg:inline-flex items-center gap-1">
                  <span>Found {sortedAndFiltered.length} matches</span>
                </div>
              )}

              {/* Balance Type Filter */}
              <div className="relative">
                <select
                  value={balanceTypeFilter}
                  onChange={(e) => {
                    setBalanceTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-2.5 pr-6 text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                >
                  <option value="ALL">Balance: All</option>
                  <option value="CREDIT">Credit Only</option>
                  <option value="DEBIT">Debit Only</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-2.5 pr-6 text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                >
                  <option value="ALL">Status: All</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Sort Dropdown */}
              <div className="relative flex items-center">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-indigo-600 dark:text-indigo-400">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-8 pr-7 text-xs font-semibold border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                  aria-label="Sort options"
                >
                  <option value="name_asc">Sort: Name (A → Z)</option>
                  <option value="name_desc">Sort: Name (Z → A)</option>
                  <option value="contact_asc">Sort: Contact Person (A → Z)</option>
                  <option value="contact_desc">Sort: Contact Person (Z → A)</option>
                  <option value="phone_asc">Sort: Phone (Ascending)</option>
                  <option value="phone_desc">Sort: Phone (Descending)</option>
                  <option value="credit_desc">Sort: Credit Limit (High to Low)</option>
                  <option value="credit_asc">Sort: Credit Limit (Low to High)</option>
                  <option value="balance_desc">Sort: Balance (High to Low)</option>
                  <option value="balance_asc">Sort: Balance (Low to High)</option>
                  <option value="latest">Sort: Latest Added</option>
                  <option value="oldest">Sort: Oldest First</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Quick Reset Button */}
              {isFilterActive && (
                <button
                  onClick={handleResetFilters}
                  className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 text-[11px] font-medium shrink-0 cursor-pointer shadow-3xs"
                  title="Reset filters and sort"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Table Container: Zero horizontal scrollbar, 100% full-width table-fixed */}
          <div className="w-full overflow-x-auto lg:overflow-x-hidden">
            <Table className="w-full table-fixed text-xs border-collapse">
              <TableHeader className="bg-slate-50/90 dark:bg-slate-950/70 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 select-none">
                <TableRow className="dark:border-slate-800">
                  {/* SN Column: 3.5% */}
                  <TableHead className="py-2 px-1 text-center text-[10px] uppercase tracking-wider font-extrabold w-[3.5%] min-w-[34px]">
                    SN
                  </TableHead>
                  
                  {/* Name Sort Header: 17% */}
                  <TableHead 
                    onClick={handleToggleSortName}
                    className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-[17%]"
                  >
                    <div className="flex items-center gap-1 truncate">
                      <span>Name</span>
                      {sortBy === 'name_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : sortBy === 'name_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                      )}
                    </div>
                  </TableHead>

                  {/* Contact Person Sort Header: 11% */}
                  <TableHead 
                    onClick={handleToggleSortContact}
                    className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-[11%]"
                  >
                    <div className="flex items-center gap-1 truncate">
                      <span>Contact</span>
                      {sortBy === 'contact_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : sortBy === 'contact_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                      )}
                    </div>
                  </TableHead>

                  {/* Phone Sort Header: 10% */}
                  <TableHead 
                    onClick={handleToggleSortPhone}
                    className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-[10%]"
                  >
                    <div className="flex items-center gap-1 truncate">
                      <span>Phone</span>
                      {sortBy === 'phone_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : sortBy === 'phone_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                      )}
                    </div>
                  </TableHead>

                  {/* Email & Tax Details: 18% */}
                  <TableHead className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold w-[18%]">
                    <div className="truncate">Email / Tax Details</div>
                  </TableHead>

                  {/* Credit Limit Sort Header: 9% */}
                  <TableHead 
                    onClick={handleToggleSortCredit}
                    className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold text-right cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-[9%]"
                  >
                    <div className="flex items-center justify-end gap-1 truncate">
                      <span>Credit</span>
                      {sortBy === 'credit_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : sortBy === 'credit_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                      )}
                    </div>
                  </TableHead>

                  {/* Opening Balance Sort Header: 9% */}
                  <TableHead 
                    onClick={handleToggleSortBalance}
                    className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold text-right cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-[9%]"
                  >
                    <div className="flex items-center justify-end gap-1 truncate">
                      <span>Balance</span>
                      {sortBy === 'balance_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : sortBy === 'balance_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                      )}
                    </div>
                  </TableHead>

                  {/* Balance Type Header: 7.5% */}
                  <TableHead 
                    onClick={handleToggleSortType}
                    className="py-2 px-1 text-[10px] uppercase tracking-wider font-extrabold text-center cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-[7.5%]"
                  >
                    <div className="flex items-center justify-center gap-1 truncate">
                      <span>Type</span>
                      {sortBy === 'balance_type' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                      )}
                    </div>
                  </TableHead>

                  {/* Address: 10% */}
                  <TableHead className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold w-[10%]">
                    <div className="truncate">Address</div>
                  </TableHead>

                  {/* Actions: 5% (min-w 52px) */}
                  <TableHead className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold text-right w-[5%] min-w-[52px]">
                    Act
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-slate-400 dark:text-slate-500 font-medium">
                      No suppliers found matching the criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSuppliers.map((supplier, index) => {
                    const computedIdx = (currentPage - 1) * itemsPerPage + index + 1;
                    return (
                      <TableRow 
                        key={supplier.id} 
                        className="hover:bg-indigo-50/30 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* SN */}
                        <TableCell className="py-2 px-1 text-slate-400 text-center font-bold text-[10px] select-none truncate">
                          {computedIdx}
                        </TableCell>

                        {/* Name */}
                        <TableCell className="py-2 px-2 font-bold text-slate-900 dark:text-slate-100 text-xs truncate" title={supplier.name}>
                          <span className="truncate block hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                            {supplier.name}
                          </span>
                        </TableCell>

                        {/* Contact Person */}
                        <TableCell className="py-2 px-2 font-medium text-slate-700 dark:text-slate-300 text-[11px] truncate" title={supplier.contactPerson || '—'}>
                          <span className="truncate block">
                            {supplier.contactPerson || '—'}
                          </span>
                        </TableCell>

                        {/* Phone */}
                        <TableCell className="py-2 px-2 font-medium text-slate-700 dark:text-slate-300 font-mono text-[11px] truncate" title={supplier.phone || '—'}>
                          <span className="truncate block">
                            {supplier.phone || '—'}
                          </span>
                        </TableCell>

                        {/* Email / Tax Details */}
                        <TableCell className="py-2 px-2 text-[11px]">
                          <div className="truncate text-slate-600 dark:text-slate-300 font-medium leading-tight" title={supplier.email || '—'}>
                            {supplier.email || '—'}
                          </div>
                          {(supplier.gstin || supplier.pan) && (
                            <div className="text-[9.5px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 truncate" title={`GST: ${supplier.gstin || '—'} | PAN: ${supplier.pan || '—'}`}>
                              {supplier.gstin && <span>GST: {supplier.gstin}</span>}
                              {supplier.gstin && supplier.pan && <span> · </span>}
                              {supplier.pan && <span>PAN: {supplier.pan}</span>}
                            </div>
                          )}
                        </TableCell>

                        {/* Credit Limit */}
                        <TableCell className="py-2 px-2 text-right font-bold text-slate-800 dark:text-slate-200 font-mono text-[11px] truncate">
                          ₹{parseFloat(supplier.creditLimit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>

                        {/* Opening Balance */}
                        <TableCell className="py-2 px-2 text-right font-bold text-slate-800 dark:text-slate-200 font-mono text-[11px] truncate">
                          ₹{parseFloat(supplier.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>

                        {/* Balance Type */}
                        <TableCell className="py-2 px-1 text-center">
                          <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-extrabold border uppercase tracking-wider ${
                            supplier.balanceType === 'CREDIT' 
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900/60' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900/60'
                          }`}>
                            {supplier.balanceType || 'CREDIT'}
                          </span>
                        </TableCell>

                        {/* Address */}
                        <TableCell className="py-2 px-2 text-slate-500 dark:text-slate-400 truncate text-[11px]" title={supplier.address || 'Not Available'}>
                          <span className="truncate block">
                            {supplier.address || '—'}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-2 px-2 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Link 
                              to={`/parties/suppliers/edit/${supplier.id}`} 
                              title="Edit supplier"
                              className="inline-flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 p-1 rounded transition-colors"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Link>
                            <button 
                              onClick={() => handleDelete(supplier.id)}
                              title="Delete supplier"
                              className="inline-flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 p-1 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination Footer */}
          <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div>
              {sortedAndFiltered.length > 0 ? (
                <span>
                  Showing <strong className="text-slate-700 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong className="text-slate-700 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, sortedAndFiltered.length)}</strong> of <strong className="text-slate-700 dark:text-slate-200">{sortedAndFiltered.length}</strong> suppliers
                </span>
              ) : (
                <span>0 suppliers found</span>
              )}
            </div>

            {totalPages > 1 && (
              <div>
                <Pagination 
                  currentPage={currentPage} 
                  totalPages={totalPages} 
                  onPageChange={setCurrentPage} 
                />
              </div>
            )}

            <div className="text-[10px] text-slate-400 hidden sm:flex items-center gap-2">
              <span>Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-2">
                <span>Per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-slate-600 dark:text-slate-300 font-semibold text-[10px] cursor-pointer focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
