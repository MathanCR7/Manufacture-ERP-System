import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CalendarIcon, RefreshCw, ArrowLeft, Loader2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

export default function CreatePOPage() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    amount: '',
    uomId: '',
    expectedDelivery: null,
  });
  
  const [errorMsg, setErrorMsg] = useState('');

  const { data: rmIdData, refetch: rotateId, isFetching: isRotating } = useQuery({
    queryKey: ['generateRmId'],
    queryFn: async () => {
      const response = await api.get('/rm/id/generate');
      return response.data;
    },
    refetchOnWindowFocus: false,
  });

  const { data: uoms = [] } = useQuery({
    queryKey: ['uoms'],
    queryFn: async () => {
      const response = await api.get('/uom');
      return response.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/rm/po', data);
      return response.data;
    },
    onSuccess: (data) => {
      alert(`PO Created successfully — RM #${data.rmId}`);
      navigate('/purchase-orders');
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.error || 'Failed to create Purchase Order');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!rmIdData?.candidateId) {
      setErrorMsg('RM ID is still generating...');
      return;
    }
    if (!formData.expectedDelivery) {
      setErrorMsg('Expected Delivery Date is required');
      return;
    }

    createMutation.mutate({
      rmId: rmIdData.candidateId,
      name: formData.name,
      quantity: Number(formData.quantity),
      amount: Number(formData.amount),
      uomId: formData.uomId,
      expectedDelivery: formData.expectedDelivery.toISOString(),
    });
  };

  const handleRotateId = (e) => {
    e.preventDefault();
    rotateId();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/purchase-orders')} className="text-slate-500 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Create Purchase Order</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Add a new raw material purchase order to the system.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
            <div className="space-y-1 mb-3 sm:mb-0">
              <Label className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">Generated RM ID</Label>
              <div className="flex items-center space-x-3">
                <Badge variant="outline" className="font-mono text-lg py-1 px-3 bg-white dark:bg-slate-900">
                  {isRotating ? '------' : rmIdData?.candidateId || 'Loading...'}
                </Badge>
              </div>
            </div>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={handleRotateId}
              disabled={isRotating}
              className="text-slate-600 dark:text-slate-300"
            >
              <RefreshCw className={twMerge("w-4 h-4 mr-2", isRotating && "animate-spin")} />
              Rotate ID
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Raw Material Name</Label>
              <Input 
                id="name" 
                placeholder="e.g. Full Cream Milk" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
                minLength={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input 
                id="quantity" 
                type="number" 
                placeholder="0.00" 
                step="0.01"
                min="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="uom">Unit of Measurement (UOM)</Label>
              <Select 
                value={formData.uomId} 
                onValueChange={(val) => setFormData({...formData, uomId: val})}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a UOM" />
                </SelectTrigger>
                <SelectContent>
                  {uoms.map((uom) => (
                    <SelectItem key={uom.id} value={uom.id}>
                      {uom.name} ({uom.abbreviation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Total Amount (₹)</Label>
              <Input 
                id="amount" 
                type="number" 
                placeholder="0.00" 
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2 flex flex-col">
              <Label htmlFor="delivery">Expected Delivery Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={twMerge(
                      "w-full justify-start text-left font-normal",
                      !formData.expectedDelivery && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.expectedDelivery ? format(formData.expectedDelivery, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.expectedDelivery}
                    onSelect={(date) => setFormData({...formData, expectedDelivery: date})}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-md text-sm font-medium border border-red-200 dark:border-red-800">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end space-x-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => navigate('/purchase-orders')}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 min-w-32">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {createMutation.isPending ? 'Creating...' : 'Create PO'}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}
