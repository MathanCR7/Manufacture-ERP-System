import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Clock, User, HardDrive } from 'lucide-react';
import { api } from '@/lib/axios';
import { format } from 'date-fns';

import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export default function AuditLogListPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', currentPage],
    queryFn: async () => {
      const response = await api.get(`/audit-logs?page=${currentPage}&limit=${itemsPerPage}`);
      return response.data;
    }
  });

  if (isLoading) {
    return <div className="p-8 space-y-6"><Skeleton className="h-[600px] w-full" /></div>;
  }

  const logs = data?.data || [];
  const meta = data?.meta || { totalPages: 1, total: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
          <ShieldAlert className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Audit Logs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">System-wide monitoring of all Create, Update, and Delete actions.</p>
        </div>
      </div>
      
      <Card className="dark:bg-[#111827] dark:border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow className="dark:border-slate-700">
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Timestamp</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">User</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Role</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">IP Address</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Action</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Table Name</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Record ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">No audit logs found</TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <TableCell className="text-sm dark:text-slate-300">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{format(new Date(log.createdAt), 'dd MMM yyyy, HH:mm:ss')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm dark:text-slate-300 font-medium">
                        <div className="flex items-center space-x-2">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{log.user?.name || log.userId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm dark:text-slate-300">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {log.user?.role || 'UNKNOWN'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm dark:text-slate-300">
                        <div className="flex items-center space-x-2">
                          <HardDrive className="w-3 h-3 text-slate-400" />
                          <span>{log.ip}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                          log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                          'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                        }`}>
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-slate-600 dark:text-slate-400">{log.tableName}</TableCell>
                      <TableCell className="text-xs font-mono text-slate-500 dark:text-slate-500" title={log.recordId}>
                        {log.recordId.substring(0, 8)}...
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <div>
              Showing {logs.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, meta.total)} of {meta.total} entries
            </div>
            <div className="flex space-x-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50 transition-opacity"
              >
                Previous
              </button>
              <div className="px-3 py-1 border rounded bg-indigo-500 text-white border-indigo-500 font-medium">
                {currentPage}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={currentPage >= meta.totalPages || meta.totalPages === 0}
                className="px-3 py-1 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50 transition-opacity"
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
