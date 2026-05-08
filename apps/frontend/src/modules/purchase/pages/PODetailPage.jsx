import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { format } from 'date-fns';
import { ArrowLeft, Trash2, ShieldCheck, User, Calendar, FileText, IndianRupee } from 'lucide-react';

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

import QRCode from 'react-qr-code';

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
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">PO: {po.rmId}</h1>
              <StatusBadge status={po.status} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Created on {format(new Date(po.createdAt), 'PPP')}</p>
          </div>
        </div>

        <div className="flex space-x-3">
          {showGrnBtn && (
            <Button variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-900/30">
              <ShieldCheck className="w-4 h-4 mr-2" />
              View GRN
            </Button>
          )}

          {isPending && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="bg-red-600 hover:bg-red-700">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete PO
                </Button>
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
                value={po.rmId} 
                size={160} 
                level="M" 
                fgColor="#0f172a" 
              />
            </div>
            <p className="text-xs text-center text-slate-500">Scan to fetch RM details</p>
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-md border border-slate-200 dark:border-slate-700 w-full text-center">
              <span className="font-mono text-lg font-bold tracking-widest text-slate-800 dark:text-slate-200">{po.rmId}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
