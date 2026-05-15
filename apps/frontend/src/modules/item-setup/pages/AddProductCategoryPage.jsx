import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import { Tag, AlignLeft, ToggleLeft, ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Input helpers ────────────────────────────────────────────────────────────
const inputCls =
  'w-full px-3 py-2.5 border rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow text-sm';

const errorInputCls =
  'w-full px-3 py-2.5 border rounded-lg bg-white dark:bg-slate-900 border-red-400 dark:border-red-500 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow text-sm';

function FieldLabel({ children, required }) {
  return (
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function FieldError({ message }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
      <AlertCircle className="w-3 h-3" />
      {message}
    </p>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AddProductCategoryPage() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: { name: '', description: '', status: 'ACTIVE' },
  });

  // ── Fetch existing record in edit mode ──────────────────────────────────────
  const { data: existingData, isLoading: isFetching } = useQuery({
    queryKey: ['product-category', id],
    queryFn: async () => {
      const res = await api.get(`/item-setup/product-category/${id}`);
      return res.data;
    },
    enabled: isEditMode,
  });

  useEffect(() => {
    if (existingData) reset(existingData);
  }, [existingData, reset]);

  // ── Mutation ────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (data) => {
      if (isEditMode) {
        return (await api.put(`/item-setup/product-category/${id}`, data)).data;
      }
      return (await api.post('/item-setup/product-category', data)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      navigate('/setup/product-category');
    },
  });

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (isEditMode && isFetching) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/setup/product-category')}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {isEditMode ? 'Edit Product Category' : 'Add Product Category'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isEditMode
              ? 'Update the details for this product category.'
              : 'Create a new product category to organise your finished goods.'}
          </p>
        </div>
      </div>

      {/* ── Mutation Error Banner ─────────────────────────────────────────── */}
      {mutation.isError && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Failed to save</p>
            <p className="text-xs mt-0.5 opacity-80">
              {mutation.error?.response?.data?.message || mutation.error?.message || 'An unexpected error occurred.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <Card className="dark:bg-[#111827] dark:border-slate-800 shadow-sm">
          {/* Section header */}
          <CardHeader className="px-6 pt-5 pb-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Tag className="w-4 h-4 text-indigo-500" />
              Category Information
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Define the name, description, and active status for this category.
            </p>
          </CardHeader>

          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div>
              <FieldLabel required>Category Name</FieldLabel>
              <input
                {...register('name', { required: 'Category name is required' })}
                placeholder="e.g. Ice Cream Mix, Kulfi Mix"
                className={errors.name ? errorInputCls : inputCls}
              />
              {errors.name && <FieldError message={errors.name.message} />}
            </div>

            {/* Status */}
            <div>
              <FieldLabel>Status</FieldLabel>
              <div className="relative">
                <ToggleLeft className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <select
                  {...register('status')}
                  className={`${inputCls} pl-9`}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Inactive categories cannot be assigned to new products.
              </p>
            </div>

            {/* Description — full width */}
            <div className="md:col-span-2">
              <FieldLabel>Description</FieldLabel>
              <div className="relative">
                <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder="Optional: describe the types of products in this category…"
                  className={`${inputCls} pl-9 resize-none`}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Action Buttons ────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm shadow-sm transition-colors"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditMode ? 'Update Category' : 'Save Category'}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/setup/product-category')}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </form>
    </div>
  );
}
