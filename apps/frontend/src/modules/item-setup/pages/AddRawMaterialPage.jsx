import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/axios';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const UOM_OPTIONS = [
  'cubic ft', 'gm', 'kg', 'meter', 'liter', 'square ft', 'pcs', 'box', 'roll'
];

export default function AddRawMaterialPage() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { unitId: 'kg', ratePerUnit: 0, openingStock: 0, alertLevel: 0, code: '' }
  });

  const { data: categories } = useQuery({
    queryKey: ['rm-categories'],
    queryFn: async () => (await api.get('/item-setup/rm-category')).data
  });

  const { data: existingData, isLoading: isFetching } = useQuery({
    queryKey: ['raw-material', id],
    queryFn: async () => (await api.get(`/item-setup/raw-material/${id}`)).data,
    enabled: isEditMode
  });

  useEffect(() => {
    if (existingData) reset(existingData);
  }, [existingData, reset]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      data.ratePerUnit = parseFloat(data.ratePerUnit) || 0;
      data.openingStock = parseFloat(data.openingStock) || 0;
      data.alertLevel = parseFloat(data.alertLevel) || 0;
      if (isEditMode) return (await api.put(`/item-setup/raw-material/${id}`, data)).data;
      return (await api.post('/item-setup/raw-material', data)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      navigate('/setup/raw-material');
    }
  });

  if (isEditMode && isFetching) return <div className="space-y-6"><Skeleton className="h-[400px] w-full" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {isEditMode ? 'Edit Raw Material' : 'Add Raw Material'}
      </h1>
      
      <form onSubmit={handleSubmit(data => mutation.mutate(data))}>
        <Card className="dark:bg-[#111827] dark:border-slate-800">
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Item Code <span className="text-red-500">*</span></label>
              <input {...register('code', { required: true })} placeholder="e.g. RM-001" className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
              {errors.code && <span className="text-xs text-red-500">Required</span>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name <span className="text-red-500">*</span></label>
              <input {...register('name', { required: true })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
              {errors.name && <span className="text-xs text-red-500">Required</span>}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Print Name</label>
              <input {...register('printName')} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category <span className="text-red-500">*</span></label>
              <select {...register('categoryId', { required: true })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white">
                <option value="">Select Category...</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.categoryId && <span className="text-xs text-red-500">Required</span>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">UOM <span className="text-red-500">*</span></label>
              <select {...register('unitId', { required: true })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white">
                {UOM_OPTIONS.map(uom => <option key={uom} value={uom}>{uom}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Rate Per Unit (INR)</label>
              <input type="number" step="0.01" {...register('ratePerUnit')} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Opening Stock</label>
              <input type="number" step="0.01" {...register('openingStock')} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alert Level (Min Stock)</label>
              <input type="number" step="0.01" {...register('alertLevel')} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <textarea {...register('description')} rows="2" className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex space-x-4">
          <button type="submit" disabled={mutation.isPending} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium">
            {mutation.isPending ? 'Submitting...' : 'Submit'}
          </button>
          <button type="button" onClick={() => navigate('/setup/raw-material')} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md font-medium">
            Back
          </button>
        </div>
      </form>
    </div>
  );
}
