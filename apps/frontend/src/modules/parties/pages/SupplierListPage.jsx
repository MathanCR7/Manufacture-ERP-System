import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Edit, Trash2, Plus, Search, Download } from 'lucide-react';
import { api } from '@/lib/axios';

import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export default function SupplierListPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await api.get('/parties/suppliers');
      return response.data;
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

  const filteredSuppliers = suppliers?.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.phone && s.phone.includes(searchTerm)) ||
    (s.contactPerson && s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
  const paginatedSuppliers = filteredSuppliers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading) {
    return <div className="p-8 space-y-6"><Skeleton className="h-[400px] w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Suppliers</h1>
      
      <Card className="dark:bg-[#111827] dark:border-slate-800">
        <CardContent className="p-0">
          <div className="p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
            <Link 
              to="/parties/suppliers/add"
              className="flex items-center px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Supplier
            </Link>
            <div className="flex items-center space-x-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search Here" 
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 border rounded-md text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow className="dark:border-slate-700">
                  <TableHead className="font-semibold text-xs whitespace-nowrap">SN</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Name</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Contact Person</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Phone</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Email</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Credit Limit</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Opening Balance</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Balance Type</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap min-w-[200px]">Address</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-slate-500">No suppliers found</TableCell>
                  </TableRow>
                ) : (
                  paginatedSuppliers.map((supplier, index) => (
                    <TableRow key={supplier.id} className="dark:border-slate-700">
                      <TableCell className="text-sm dark:text-slate-300">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                      <TableCell className="text-sm dark:text-slate-300 font-medium">{supplier.name}</TableCell>
                      <TableCell className="text-sm dark:text-slate-300">{supplier.contactPerson || 'N/A'}</TableCell>
                      <TableCell className="text-sm dark:text-slate-300">{supplier.phone}</TableCell>
                      <TableCell className="text-sm text-slate-500 dark:text-slate-400">{supplier.email || 'N/A'}</TableCell>
                      <TableCell className="text-sm dark:text-slate-300">INR {parseFloat(supplier.creditLimit).toFixed(2)}</TableCell>
                      <TableCell className="text-sm dark:text-slate-300">INR {parseFloat(supplier.openingBalance).toFixed(2)}</TableCell>
                      <TableCell className="text-sm dark:text-slate-300 capitalize">{supplier.balanceType?.toLowerCase()}</TableCell>
                      <TableCell className="text-sm dark:text-slate-300 truncate max-w-[200px]">{supplier.address || 'N/A'}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Link to={`/parties/suppliers/edit/${supplier.id}`} className="inline-block text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 p-1 rounded transition-colors">
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleDelete(supplier.id)}
                          className="inline-block text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-1 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <div>
              Showing {filteredSuppliers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredSuppliers.length)} of {filteredSuppliers.length} entries
            </div>
            <div className="flex space-x-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button 
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-3 py-1 border rounded ${currentPage === i + 1 ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-slate-50 dark:bg-slate-800 dark:border-slate-700'}`}
                >
                  {i + 1}
                </button>
              ))}
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-3 py-1 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
