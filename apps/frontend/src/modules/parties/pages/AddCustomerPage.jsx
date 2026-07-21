import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import DatePicker from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/button';

export default function AddCustomerPage() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({
    defaultValues: { balanceType: 'DEBIT', customerType: 'RETAIL' }
  });

  const { data: existingCustomer, isLoading: isFetching } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const response = await api.get(`/parties/customers/${id}`);
      return response.data;
    },
    enabled: isEditMode
  });

  useEffect(() => {
    if (existingCustomer) {
      reset({
        ...existingCustomer,
        dob: existingCustomer.dob ? new Date(existingCustomer.dob).toISOString().split('T')[0] : '',
        doa: existingCustomer.doa ? new Date(existingCustomer.doa).toISOString().split('T')[0] : ''
      });
    }
  }, [existingCustomer, reset]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (isEditMode) {
        const response = await api.put(`/parties/customers/${id}`, data);
        return response.data;
      } else {
        const response = await api.post('/parties/customers', data);
        return response.data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">${isEditMode ? 'Customer Updated!' : 'Customer Added!'}</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${isEditMode ? `Customer "${data.name}" has been updated.` : `Customer "${data.name}" has been registered successfully.`}</p>`,
        icon: 'success',
        iconColor: '#10b981',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-emerald-500'
        }
      });
      navigate('/parties/customers');
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Operation Failed</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Failed to save customer details.'}</p>`,
        icon: 'error',
        iconColor: '#ef4444',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-red-100 dark:border-red-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-red-500'
        }
      });
    }
  });

  const onSubmit = (data) => {
    mutation.mutate(data);
  };

  if (isEditMode && isFetching) {
    return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {isEditMode ? 'Edit Customer' : 'Add Customer'}
      </h1>
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 rounded-2xl shadow-xs overflow-hidden text-xs">
          <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Row 1 */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Name <span className="text-red-500">*</span></label>
              <input 
                {...register('name', { required: true })} 
                className="w-full px-3 py-2 border border-slate-200 rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-semibold text-xs" 
                placeholder="Name" 
              />
              {errors.name && <span className="text-3xs text-red-500 font-bold">Name is required</span>}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Phone <span className="text-red-500">*</span></label>
              <input 
                {...register('phone', { required: true })} 
                className="w-full px-3 py-2 border border-slate-200 rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-semibold text-xs" 
                placeholder="Phone" 
              />
              {errors.phone && <span className="text-3xs text-red-500 font-bold">Phone is required</span>}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Email</label>
              <input 
                {...register('email')} 
                type="email"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-semibold text-xs" 
                placeholder="Email" 
              />
            </div>

            {/* Row 2 */}
            <div className="space-y-1 col-span-1">
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Opening Balance</label>
              <div className="flex space-x-2">
                <input 
                  {...register('openingBalance')} 
                  type="number" step="0.01"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-mono text-xs font-bold" 
                  placeholder="0.00" 
                />
                <select 
                  {...register('balanceType')}
                  className="w-24 px-3 py-2 border border-slate-200 rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-semibold text-xs"
                >
                  <option value="DEBIT">Debit</option>
                  <option value="CREDIT">Credit</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Credit Limit</label>
              <input 
                {...register('creditLimit')} 
                type="number" step="0.01"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-mono text-xs font-bold" 
                placeholder="0.00" 
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Default Discount (%)</label>
              <input 
                {...register('defaultDiscount')} 
                type="number" step="0.01"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-mono text-xs font-bold" 
                placeholder="0.00" 
              />
            </div>

            {/* Row 3 */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Customer Type</label>
              <select 
                {...register('customerType')}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-semibold text-xs"
              >
                <option value="RETAIL">Retail</option>
                <option value="WHOLESALE">Wholesale</option>
                <option value="DISTRIBUTOR">Distributor</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">GSTIN / GST Number</label>
              <input 
                {...register('gstin')} 
                className="w-full px-3 py-2 border border-slate-200 rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 uppercase font-mono text-xs font-bold" 
                placeholder="e.g. 33AABCL0702C1ZG" 
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Date of Birth</label>
              <Controller
                control={control}
                name="dob"
                render={({ field: { value, onChange } }) => (
                  <DatePicker
                    value={value ? new Date(value) : null}
                    onChange={date => onChange(date ? date.toISOString().split('T')[0] : '')}
                    modalTitle="Date of Birth"
                    placeholder="Select Date"
                    triggerClassName="h-9 text-xs rounded-xl font-semibold border-slate-200 bg-white dark:bg-slate-950"
                  />
                )}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Date of Anniversary</label>
              <Controller
                control={control}
                name="doa"
                render={({ field: { value, onChange } }) => (
                  <DatePicker
                    value={value ? new Date(value) : null}
                    onChange={date => onChange(date ? date.toISOString().split('T')[0] : '')}
                    modalTitle="Date of Anniversary"
                    placeholder="Select Date"
                    triggerClassName="h-9 text-xs rounded-xl font-semibold border-slate-200 bg-white dark:bg-slate-950"
                  />
                )}
              />
            </div>

            {/* Row 4 (Textareas) */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Address</label>
              <textarea 
                {...register('address')} 
                rows="2"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-semibold resize-none" 
                placeholder="Address"
              ></textarea>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">Note</label>
              <textarea 
                {...register('note')} 
                rows="2"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-semibold resize-none" 
                placeholder="Note"
              ></textarea>
            </div>

          </CardContent>
        </Card>

        <div className="mt-4 flex space-x-3">
          <Button 
            type="submit" 
            disabled={mutation.isPending}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md font-bold text-xs cursor-pointer h-9"
          >
            {mutation.isPending ? 'Submitting...' : 'Submit'}
          </Button>
          <Button 
            type="button" 
            onClick={() => navigate('/parties/customers')}
            className="px-6 py-2 bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-800 text-white rounded-xl shadow-md font-bold text-xs cursor-pointer h-9 transition-colors"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
