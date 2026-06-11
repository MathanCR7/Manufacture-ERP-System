import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AddSupplierPage() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isVerifyingGstin, setIsVerifyingGstin] = React.useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    defaultValues: { balanceType: 'CREDIT' }
  });

  const { data: existingSupplier, isLoading: isFetching } = useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      const response = await api.get(`/parties/suppliers/${id}`);
      return response.data;
    },
    enabled: isEditMode
  });

  useEffect(() => {
    if (existingSupplier) {
      reset(existingSupplier);
    }
  }, [existingSupplier, reset]);

  const handleVerifyGSTIN = async () => {
    const gstinValue = watch('gstin');
    if (!gstinValue || !gstinValue.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'GSTIN Required',
        text: 'Please enter a GSTIN to verify.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }
    const cleanGstin = gstinValue.trim().toUpperCase();
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!regex.test(cleanGstin)) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid GSTIN Format',
        text: 'Standard GSTIN format: 2-digit State Code + 10-char PAN + Entity Digit + Z + Check Digit (15 characters total).',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    setIsVerifyingGstin(true);
    try {
      const res = await api.get(`/asset-management/verify-gstin/${cleanGstin}`);
      const data = res.data;

      const isLive = data.source === 'live';
      const statusColor = data.status?.toLowerCase() === 'active' ? '#10b981' : '#ef4444';
      const statusBadge = data.status?.toLowerCase() === 'active'
        ? `<span style="background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:999px;font-weight:700;font-size:11px;">✓ ${data.status?.toUpperCase() || 'ACTIVE'}</span>`
        : `<span style="background:#fee2e2;color:#991b1b;padding:2px 10px;border-radius:999px;font-weight:700;font-size:11px;">✗ ${data.status?.toUpperCase() || 'UNKNOWN'}</span>`;

      const row = (label, value) =>
        value ? `<tr><td style="color:#6b7280;font-size:11px;padding:5px 0;text-align:left;width:48%;">${label}</td><td style="font-size:12px;font-weight:600;color:#111827;text-align:right;">${value}</td></tr>` : '';

      const tableHtml = `
        <div style="text-align:left">
          ${data.warning ? `<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;font-size:11px;color:#92400e;margin-bottom:12px;">⚠️ ${data.warning}</div>` : ''}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <code style="font-size:13px;font-weight:700;color:#4f46e5;letter-spacing:1px;">${data.gstin}</code>
            ${statusBadge}
          </div>
          <table style="width:100%;border-collapse:collapse;">
            ${row('Legal Name', data.legalName || '<span style="color:#9ca3af;font-style:italic;">Not available (live API required)</span>')}
            ${row('Trade Name', data.tradeName && data.tradeName !== data.legalName ? data.tradeName : '')}
            ${row('PAN', data.pan)}
            ${row('State', `${data.state} (${data.stateCode})`)}
            ${row('Constitution', data.constitutionOfBusiness)}
            ${row('Taxpayer Type', data.taxpayerType)}
            ${row('Registration Date', data.registrationDate)}
            ${row('Last Updated', data.lastUpdatedDate)}
            ${row('Principal Address', data.principalAddress || '<span style="color:#9ca3af;font-style:italic;">Not available (live API required)</span>')}
          </table>
          <div style="margin-top:12px;font-size:10px;color:#9ca3af;text-align:center;">
            ${isLive ? '🟢 Live data from GST Portal' : '🔵 Parsed from GSTIN format (offline mode)'}
          </div>
        </div>
      `;

      const result = await Swal.fire({
        title: '<span style="font-size:15px;">🔍 GST Registry Verification</span>',
        html: tableHtml,
        showCancelButton: true,
        confirmButtonText: 'Apply Details to Form',
        cancelButtonText: 'Close',
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#6b7280',
        customClass: {
          popup: 'rounded-2xl',
          htmlContainer: 'text-left'
        },
        width: '500px'
      });

      if (result.isConfirmed) {
        setValue('gstin', cleanGstin);
        setValue('pan', data.pan || '');
        if (data.legalName) setValue('name', data.legalName);
        if (data.principalAddress) setValue('address', data.principalAddress);
      }
    } catch (err) {
      console.error('GSTIN verification error:', err);
      const errMsg = err.response?.data?.error || err.message || 'Unable to verify GSTIN. Please try again.';
      Swal.fire({
        icon: 'error',
        title: 'Verification Failed',
        text: errMsg,
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setIsVerifyingGstin(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (isEditMode) {
        const response = await api.put(`/parties/suppliers/${id}`, data);
        return response.data;
      } else {
        const response = await api.post('/parties/suppliers', data);
        return response.data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">${isEditMode ? 'Supplier Updated!' : 'Supplier Registered!'}</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${isEditMode ? `Supplier "${data.name}" has been updated.` : `Supplier "${data.name}" has been registered successfully.`}</p>`,
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
      navigate('/parties/suppliers');
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Operation Failed</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.message || 'Failed to save supplier details.'}</p>`,
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
        {isEditMode ? 'Edit Supplier' : 'Add Supplier'}
      </h1>
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="dark:bg-[#111827] dark:border-slate-800">
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Row 1 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">GSTIN</label>
              <div className="flex gap-2">
                <input 
                  {...register('gstin')} 
                  className="flex-1 px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono uppercase text-sm" 
                  placeholder="22AAAAA0000A1Z5" 
                />
                {!isEditMode && (
                  <button
                    type="button"
                    disabled={isVerifyingGstin}
                    onClick={handleVerifyGSTIN}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                  >
                    {isVerifyingGstin ? 'Fetching...' : 'Fetch Details'}
                  </button>
                )}
              </div>
            </div>

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
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Contact Person</label>
              <input 
                {...register('contactPerson')} 
                className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                placeholder="Contact Person" 
              />
            </div>

            {/* Row 2 */}
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">PAN</label>
              <input 
                {...register('pan')} 
                className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono uppercase" 
                placeholder="AAAAA0000A" 
              />
            </div>

            {/* Row 3 */}
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
              {/* spacer */}
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
            onClick={() => navigate('/parties/suppliers')}
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md shadow-sm font-medium transition-colors"
          >
            Back
          </button>
        </div>
      </form>
    </div>
  );
}
