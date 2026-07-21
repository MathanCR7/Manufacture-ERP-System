import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Edit, Trash2, Plus, Search } from 'lucide-react';
import { api } from '@/lib/axios';

import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import AddCustomerPage from './AddCustomerPage';
import { Pagination } from '@/components/ui/Pagination';

export default function CustomerListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState({ type: 'list', prefill: null });

  useEffect(() => {
    if (location.pathname === '/parties/customers/add' || location.pathname.startsWith('/parties/customers/edit/') || location.state) {
      setView({ type: 'create', prefill: location.state });
    } else {
      setView({ type: 'list', prefill: null });
    }
  }, [location]);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await api.get('/parties/customers');
      return response.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/parties/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredCustomers = customers?.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm))
  ) || [];

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading) {
    return <div className="p-8 space-y-6"><Skeleton className="h-[400px] w-full" /></div>;
  }

  if (view.type === 'create') {
    return <AddCustomerPage />;
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-205 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Customers</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Manage and monitor customer outstanding profiles</p>
        </div>
        <Link 
          to="/parties/customers/add"
          className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all text-xs font-bold shadow-md h-9"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Customer
        </Link>
      </div>
      
      <Card className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 rounded-2xl shadow-xs overflow-hidden flex flex-col text-xs">
        <CardContent className="p-0">
          <div className="p-4 flex justify-end items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-404" />
              <input 
                type="text" 
                placeholder="Search customers..." 
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-3 py-2 w-full border border-slate-200 rounded-xl text-xs dark:bg-slate-950 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50 dark:bg-slate-950 text-slate-505 dark:text-slate-455 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest">
                <TableRow className="dark:border-slate-800">
                  <TableHead className="font-semibold text-xs whitespace-nowrap py-3 w-12 text-center">SN</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap py-3">Name</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap py-3">Phone</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap py-3">Email</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap py-3 text-right">Credit Limit</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap py-3 text-right">Opening Balance</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap py-3 text-center">Balance Type</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap py-3 min-w-[200px]">Address</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap py-3">Note</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap py-3">Added By</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap py-3 text-right w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCustomers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-slate-400 bg-slate-50/10 font-semibold">No customers found</TableCell>
                  </TableRow>
                ) : (
                  paginatedCustomers?.map((customer, index) => {
                    const computedIdx = (currentPage - 1) * itemsPerPage + index + 1;
                    return (
                      <TableRow key={customer.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-805/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                        <TableCell className="text-slate-400 text-center font-bold">{computedIdx}</TableCell>
                        <TableCell className="font-bold text-slate-900 dark:text-slate-100">{customer.name}</TableCell>
                        <TableCell className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{customer.phone}</TableCell>
                        <TableCell className="text-slate-505 dark:text-slate-400">{customer.email || 'N/A'}</TableCell>
                        <TableCell className="text-right font-bold text-slate-700 dark:text-slate-300 font-mono">₹{parseFloat(customer.creditLimit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-bold text-slate-700 dark:text-slate-300 font-mono">₹{parseFloat(customer.openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2 py-0.5 rounded-lg text-3xs font-bold border uppercase ${
                            customer.balanceType === 'CREDIT' 
                              ? 'bg-rose-500/10 text-rose-650 border-rose-500/20' 
                              : 'bg-emerald-500/10 text-emerald-650 border-emerald-500/20'
                          }`}>
                            {customer.balanceType?.toLowerCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-500 dark:text-slate-400 truncate max-w-[200px] font-medium">{customer.address || 'N/A'}</TableCell>
                        <TableCell className="text-slate-500 dark:text-slate-450 truncate max-w-[100px] font-medium">{customer.note || 'N/A'}</TableCell>
                        <TableCell className="text-slate-650 dark:text-slate-400 font-bold text-[10px]">{customer.user?.name || 'Admin'}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1">
                            <Link to={`/parties/customers/edit/${customer.id}`} className="inline-block text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 p-1 rounded-lg transition-colors">
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button 
                              onClick={() => handleDelete(customer.id)}
                              className="inline-block text-rose-505 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-1 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
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
          
          {/* Footer info & Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-[11px] text-slate-555 dark:text-slate-400 font-medium order-2 sm:order-1">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length} entries
              </div>

              <div className="order-1 sm:order-2">
                <Pagination 
                  currentPage={currentPage} 
                  totalPages={totalPages} 
                  onPageChange={setCurrentPage} 
                />
              </div>

              <div className="text-xs text-slate-404 font-medium order-3">
                Total entries: {filteredCustomers.length} records
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
