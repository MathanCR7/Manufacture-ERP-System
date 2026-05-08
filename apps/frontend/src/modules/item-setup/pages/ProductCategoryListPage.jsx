import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Edit, Trash2, Plus, Search } from 'lucide-react';
import { api } from '@/lib/axios';

import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProductCategoryListPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: categories, isLoading } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => (await api.get('/item-setup/product-category')).data
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => await api.delete(`/item-setup/product-category/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['product-categories'] })
  });

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this?')) deleteMutation.mutate(id);
  };

  const filtered = categories?.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())) || [];
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading) return <div className="p-8"><Skeleton className="h-[400px] w-full" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Product Categories</h1>
      <Card className="dark:bg-[#111827] dark:border-slate-800">
        <CardContent className="p-0">
          <div className="p-4 flex justify-between items-center border-b dark:border-slate-700">
            <Link to="/setup/product-category/add" className="flex items-center px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md text-sm font-medium">
              <Plus className="w-4 h-4 mr-2" /> Add Category
            </Link>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-9 pr-4 py-2 border rounded-md text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow className="dark:border-slate-700">
                  <TableHead>SN</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8">No categories found</TableCell></TableRow>
                ) : (
                  paginated.map((item, i) => (
                    <TableRow key={item.id} className="dark:border-slate-700">
                      <TableCell>{(currentPage - 1) * itemsPerPage + i + 1}</TableCell>
                      <TableCell className="font-medium text-indigo-600 dark:text-indigo-400">{item.name}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Link to={`/setup/product-category/edit/${item.id}`} className="inline-block text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 p-1 rounded"><Edit className="w-4 h-4" /></Link>
                        <button onClick={() => handleDelete(item.id)} className="inline-block text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 border-t dark:border-slate-700 flex justify-between text-sm text-slate-500">
            <div>Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries</div>
            <div className="flex space-x-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50">Previous</button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} onClick={() => setCurrentPage(i + 1)} className={`px-3 py-1 border rounded ${currentPage === i + 1 ? 'bg-indigo-500 text-white' : 'bg-slate-50 dark:bg-slate-800'}`}>{i + 1}</button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50">Next</button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
