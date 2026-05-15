import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { format } from 'date-fns';
import { ArrowLeft, Trash2, ShieldCheck, User, Calendar, FileText, IndianRupee, Printer, Edit } from 'lucide-react';

import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Safely import QRCode avoiding CJS/ESM interop crash in dev mode
import _QRCode from 'react-qr-code';
const QRCode = typeof _QRCode === 'function' ? _QRCode : (_QRCode?.default || _QRCode?.QRCode || 'div');

export default function PODetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: po, isLoading, error } = useQuery({
    queryKey: ['po', id],
    queryFn: async () => {
      const response = await api.get(`/rm/po/${id}`);
      return response.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/rm/po/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos'] });
      navigate('/purchase-orders');
    }
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center mt-20">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">PO Not Found</h2>
        <Button onClick={() => navigate('/purchase-orders')} variant="outline" className="mt-4">
          Back to List
        </Button>
      </div>
    );
  }

  const isPending = po.status === 'PENDING';
  const showGrnBtn = po.status === 'RECEIVED' || po.status === 'APPROVED' || po.status === 'QC_PASSED' || po.status === 'QC_FAILED';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/purchase-orders')} className="text-slate-500 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">PO: {po.referenceNo || po.rmId}</h1>
              <StatusBadge status={po.status} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Created on {format(new Date(po.createdAt), 'PPP')} | RM ID: {po.rmId}</p>
          </div>
        </div>

        <div className="flex space-x-3">
          {isPending && (
            <Button
              variant="outline"
              className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
              onClick={() => navigate(`/purchase-orders/edit/${id}`)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit PO
            </Button>
          )}

          <Button variant="outline" className="text-slate-700 border-slate-300 hover:bg-slate-100 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800 print:hidden" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Print Label
          </Button>

          {isPending && (
            <AlertDialog>
              <AlertDialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-red-600 hover:bg-red-700 text-white">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete PO
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Purchase Order?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete PO for RM ID {po.rmId}? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-red-600 hover:bg-red-700 text-white">
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">Material Details</h3>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Raw Material Name</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{po.name}</p>
                </div>
              </div>

              {po.supplier && (
                <div className="flex items-start space-x-3">
                  <User className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Supplier</p>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{po.supplier.name}</p>
                    {po.supplier.phone && <p className="text-xs text-slate-500">{po.supplier.phone}</p>}
                  </div>
                </div>
              )}
              
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 flex items-center justify-center text-slate-400 font-bold mt-0.5">#</div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Quantity & UOM</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{po.quantity} {po.uom?.abbreviation || po.uom?.name}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <IndianRupee className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Amount</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">₹{parseFloat(po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">Order Information</h3>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Expected Delivery</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{format(new Date(po.expectedDelivery), 'PPPP')}</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <User className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Created By</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{po.user?.name}</p>
                  <p className="text-xs text-slate-500">{po.user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-1">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 w-full text-center border-b border-slate-100 dark:border-slate-800 pb-2">RM QR Code</h3>
            <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
              <QRCode 
                value={po.referenceNo || po.rmId} 
                size={160} 
                level="M" 
                fgColor="#0f172a" 
              />
            </div>
            <p className="text-xs text-center text-slate-500">Scan to fetch RM details</p>
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-md border border-slate-200 dark:border-slate-700 w-full text-center">
              <span className="font-mono text-lg font-bold tracking-widest text-slate-800 dark:text-slate-200">{po.referenceNo || po.rmId}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Label Section */}
      <div className="hidden print:flex fixed inset-0 bg-white z-[9999] flex-col items-center justify-center p-8 text-black">
        <div className="border-4 border-black p-8 rounded-2xl flex flex-col items-center max-w-sm w-full space-y-6">
          <h1 className="text-3xl font-black uppercase tracking-widest border-b-2 border-black pb-2 w-full text-center">
            RM Label
          </h1>
          <div className="bg-white p-2 border-2 border-black rounded-lg">
            <QRCode 
              value={po.referenceNo || po.rmId} 
              size={200} 
              level="M" 
              fgColor="#000000" 
            />
          </div>
          <div className="w-full space-y-3 text-lg font-bold">
            <div className="flex justify-between border-b border-gray-300 pb-1">
              <span className="text-gray-500 uppercase text-sm font-bold">Ref No:</span>
              <span>{po.referenceNo || po.rmId}</span>
            </div>
            <div className="flex justify-between border-b border-gray-300 pb-1">
              <span className="text-gray-500 uppercase text-sm font-bold">Item:</span>
              <span>{po.name}</span>
            </div>
            <div className="flex justify-between border-b border-gray-300 pb-1">
              <span className="text-gray-500 uppercase text-sm font-bold">Quantity:</span>
              <span>{po.quantity} {po.uom?.abbreviation || po.uom?.name}</span>
            </div>
            {po.supplier && (
              <div className="flex justify-between border-b border-gray-300 pb-1">
                <span className="text-gray-500 uppercase text-sm font-bold">Supplier:</span>
                <span>{po.supplier.name}</span>
              </div>
            )}
            <div className="flex justify-between pb-1">
              <span className="text-gray-500 uppercase text-sm font-bold">Date:</span>
              <span>{format(new Date(), 'dd-MM-yyyy')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
