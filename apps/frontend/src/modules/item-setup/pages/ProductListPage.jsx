import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Edit, Trash2, Plus, Search, Tag, Package, DollarSign, Settings } from 'lucide-react';
import { api } from '@/lib/axios';

import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProductListPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/products')).data
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => await api.delete(`/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] })
  });

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this finished product?')) {
      deleteMutation.mutate(id);
    }
  };

  const filtered = products?.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading) return <div className="p-8"><Skeleton className="h-[400px] w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-500" /> Finished Products
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage finished products, bills of materials (BOM), production stages, and pricing.
          </p>
        </div>
        <Link to="/setup/product/add" className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-indigo-500/10">
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </Link>
      </div>

      <Card className="dark:bg-[#111827] dark:border-slate-800">
        <CardContent className="p-0">
          <div className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b dark:border-slate-700">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search products by code or name..." 
                value={searchTerm} 
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow className="dark:border-slate-700">
                  <TableHead className="w-[120px]">Code</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">BOM RM Cost</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right text-indigo-600 dark:text-indigo-400">Sale Price</TableHead>
                  <TableHead className="text-center w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400 dark:text-slate-500">
                      No finished products found. Get started by clicking "Add Product"!
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((item) => (
                    <TableRow key={item.id} className="dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <TableCell className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">{item.code}</TableCell>
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100">{item.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border dark:border-slate-700">
                          <Tag className="w-3 h-3 mr-1 text-slate-400" /> {item.category?.name || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400 font-medium">{item.unit?.abbreviation || item.unit?.name || item.unitId || 'N/A'}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-500">₹{parseFloat(item.totalRawMaterialCost || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-600 dark:text-slate-350">₹{parseFloat(item.totalCost || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400">₹{parseFloat(item.salePrice || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-center space-x-2">
                        <Link 
                          to={`/setup/product/edit/${item.id}`} 
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                          title="Edit Product"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleDelete(item.id)} 
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          title="Delete Product"
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

          <div className="p-4 border-t dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-500">
            <div>
              Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries
            </div>
            <div className="flex space-x-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1} 
                className="px-3 py-1 border rounded-lg bg-slate-50 dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button 
                  key={i} 
                  onClick={() => setCurrentPage(i + 1)} 
                  className={`px-3 py-1 border rounded-lg transition-colors ${currentPage === i + 1 ? 'bg-indigo-500 text-white border-indigo-500 font-semibold' : 'bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}
                >
                  {i + 1}
                </button>
              ))}
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages || totalPages === 0} 
                className="px-3 py-1 border rounded-lg bg-slate-50 dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50"
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
