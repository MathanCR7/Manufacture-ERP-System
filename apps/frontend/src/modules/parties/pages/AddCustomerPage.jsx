import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import DatePicker from '@/components/ui/DatePicker';

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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {isEditMode ? 'Edit Customer' : 'Add Customer'}
      </h1>
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="dark:bg-[#111827] dark:border-slate-800">
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Row 1 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name <span className="text-red-500">*</span></label>
              <input 
                {...register('name', { required: true })} 
                className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                placeholder="Name" 
              />
              {errors.name && <span className="text-xs text-red-500">Name is required</span>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone <span className="text-red-500">*</span></label>
              <input 
                {...register('phone', { required: true })} 
                className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                placeholder="Phone" 
              />
              {errors.phone && <span className="text-xs text-red-500">Phone is required</span>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
              <input 
                {...register('email')} 
                type="email"
                className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                placeholder="Email" 
              />
            </div>

            {/* Row 2 */}
            <div className="space-y-2 col-span-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Opening Balance</label>
              <div className="flex space-x-2">
                <input 
                  {...register('openingBalance')} 
                  type="number" step="0.01"
                  className="flex-1 px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                  placeholder="0.00" 
                />
                <select 
                  {...register('balanceType')}
                  className="w-24 px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="DEBIT">Debit</option>
                  <option value="CREDIT">Credit</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Credit Limit</label>
              <input 
                {...register('creditLimit')} 
                type="number" step="0.01"
                className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                placeholder="0.00" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Default Discount (%)</label>
              <input 
                {...register('defaultDiscount')} 
                type="number" step="0.01"
                className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                placeholder="0.00" 
              />
            </div>

            {/* Row 3 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Customer Type</label>
              <select 
                {...register('customerType')}
                className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="RETAIL">Retail</option>
                <option value="WHOLESALE">Wholesale</option>
                <option value="DISTRIBUTOR">Distributor</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-305">Date of Birth</label>
              <Controller
                control={control}
                name="dob"
                render={({ field: { value, onChange } }) => (
                  <DatePicker
                    value={value ? new Date(value) : null}
                    onChange={date => onChange(date ? date.toISOString().split('T')[0] : '')}
                    modalTitle="Date of Birth"
                    placeholder="Select Date"
                    triggerClassName="h-10 text-sm"
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-305">Date of Anniversary</label>
              <Controller
                control={control}
                name="doa"
                render={({ field: { value, onChange } }) => (
                  <DatePicker
                    value={value ? new Date(value) : null}
                    onChange={date => onChange(date ? date.toISOString().split('T')[0] : '')}
                    modalTitle="Date of Anniversary"
                    placeholder="Select Date"
                    triggerClassName="h-10 text-sm"
                  />
                )}
              />
            </div>

            {/* Row 4 (Textareas) */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Address</label>
              <textarea 
                {...register('address')} 
                rows="3"
                className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                placeholder="Address"
              ></textarea>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Note</label>
              <textarea 
                {...register('note')} 
                rows="3"
                className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                placeholder="Note"
              ></textarea>
            </div>

          </CardContent>
        </Card>

        <div className="mt-6 flex space-x-4">
          <button 
            type="submit" 
            disabled={mutation.isPending}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm font-medium transition-colors"
          >
            {mutation.isPending ? 'Submitting...' : 'Submit'}
          </button>
          <button 
            type="button" 
            onClick={() => navigate('/parties/customers')}
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md shadow-sm font-medium transition-colors"
          >
            Back
          </button>
        </div>
      </form>
    </div>
  );
}
