import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import {
  FlaskConical, Plus, Edit2, Trash2, Check, X, Loader2,
  AlertTriangle, Save, RefreshCw, ChevronDown, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import useAuthStore from '@/app/store/authStore';

function ParamRow({ param, canEdit, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...param });

  const handleSave = () => {
    onUpdate(param.id, form);
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="bg-indigo-50/50 dark:bg-indigo-500/5">
        <td className="px-4 py-2">
          <Input value={form.paramName} onChange={e => setForm(p => ({ ...p, paramName: e.target.value }))} className="h-8 text-xs" />
        </td>
        <td className="px-4 py-2">
          <Input value={form.paramUnit || ''} onChange={e => setForm(p => ({ ...p, paramUnit: e.target.value }))} placeholder="%, g/L, CFU/ml" className="h-8 text-xs" />
        </td>
        <td className="px-4 py-2">
          <Input type="number" value={form.acceptableMin ?? ''} onChange={e => setForm(p => ({ ...p, acceptableMin: e.target.value ? Number(e.target.value) : null }))} placeholder="Min" className="h-8 text-xs" />
        </td>
        <td className="px-4 py-2">
          <Input type="number" value={form.acceptableMax ?? ''} onChange={e => setForm(p => ({ ...p, acceptableMax: e.target.value ? Number(e.target.value) : null }))} placeholder="Max" className="h-8 text-xs" />
        </td>
        <td className="px-4 py-2">
          <Input value={form.acceptableText || ''} onChange={e => setForm(p => ({ ...p, acceptableText: e.target.value }))} placeholder='e.g. "Absent"' className="h-8 text-xs" />
        </td>
        <td className="px-4 py-2">
          <Input value={form.testMethod || ''} onChange={e => setForm(p => ({ ...p, testMethod: e.target.value }))} placeholder="AOAC, IS method" className="h-8 text-xs" />
        </td>
        <td className="px-4 py-2 text-center">
          <select
            value={form.isRequired ? 'true' : 'false'}
            onChange={e => setForm(p => ({ ...p, isRequired: e.target.value === 'true' }))}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-1">
            <button onClick={handleSave} className="p-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors" title="Save"><Check className="w-3 h-3" /></button>
            <button onClick={() => setEditing(false)} className="p-1.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300 transition-colors" title="Cancel"><X className="w-3 h-3" /></button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 text-sm">{param.paramName}</td>
      <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{param.paramUnit || '—'}</td>
      <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400">{param.acceptableMin != null ? param.acceptableMin : '—'}</td>
      <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400">{param.acceptableMax != null ? param.acceptableMax : '—'}</td>
      <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400 max-w-[160px] truncate">{param.acceptableText || '—'}</td>
      <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{param.testMethod || '—'}</td>
      <td className="px-4 py-2.5 text-center">
        {param.isRequired
          ? <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 justify-center"><CheckCircle2 className="w-3 h-3" />Yes</span>
          : <span className="text-xs text-slate-400">No</span>
        }
      </td>
      <td className="px-4 py-2.5">
        {canEdit && (
          <div className="flex items-center gap-1">
            <button onClick={() => setEditing(true)} className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors" title="Edit">
              <Edit2 className="w-3 h-3" />
            </button>
            <button onClick={() => onDelete(param.id)} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Delete">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function NewParamForm({ onAdd, onCancel, saving }) {
  const [form, setForm] = useState({
    paramName: '', paramUnit: '', acceptableMin: '', acceptableMax: '',
    acceptableText: '', testMethod: '', isRequired: true,
  });

  const handleAdd = () => {
    if (!form.paramName) return;
    onAdd({
      paramName: form.paramName.trim(),
      paramUnit: form.paramUnit.trim() || undefined,
      acceptableMin: form.acceptableMin !== '' ? Number(form.acceptableMin) : undefined,
      acceptableMax: form.acceptableMax !== '' ? Number(form.acceptableMax) : undefined,
      acceptableText: form.acceptableText.trim() || undefined,
      testMethod: form.testMethod.trim() || undefined,
      isRequired: form.isRequired,
    });
  };

  return (
    <tr className="bg-emerald-50/50 dark:bg-emerald-500/5 border-t-2 border-emerald-200 dark:border-emerald-500/30">
      <td className="px-4 py-2">
        <Input value={form.paramName} onChange={e => setForm(p => ({ ...p, paramName: e.target.value }))} placeholder="e.g. Fat %" className="h-8 text-xs" autoFocus />
      </td>
      <td className="px-4 py-2">
        <Input value={form.paramUnit} onChange={e => setForm(p => ({ ...p, paramUnit: e.target.value }))} placeholder="%, g/L" className="h-8 text-xs" />
      </td>
      <td className="px-4 py-2">
        <Input type="number" value={form.acceptableMin} onChange={e => setForm(p => ({ ...p, acceptableMin: e.target.value }))} placeholder="Min" className="h-8 text-xs" />
      </td>
      <td className="px-4 py-2">
        <Input type="number" value={form.acceptableMax} onChange={e => setForm(p => ({ ...p, acceptableMax: e.target.value }))} placeholder="Max" className="h-8 text-xs" />
      </td>
      <td className="px-4 py-2">
        <Input value={form.acceptableText} onChange={e => setForm(p => ({ ...p, acceptableText: e.target.value }))} placeholder='"Absent"' className="h-8 text-xs" />
      </td>
      <td className="px-4 py-2">
        <Input value={form.testMethod} onChange={e => setForm(p => ({ ...p, testMethod: e.target.value }))} placeholder="Method" className="h-8 text-xs" />
      </td>
      <td className="px-4 py-2 text-center">
        <select
          value={form.isRequired ? 'true' : 'false'}
          onChange={e => setForm(p => ({ ...p, isRequired: e.target.value === 'true' }))}
          className="text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1">
          <button onClick={handleAdd} disabled={saving} className="p-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60" title="Add">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </button>
          <button onClick={onCancel} className="p-1.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300 transition-colors" title="Cancel">
            <X className="w-3 h-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function RMRequiredLabResultsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const canEdit = ['MAIN_MASTER', 'LAB_ASSISTANT'].includes(user?.role);

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [addingParam, setAddingParam] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['rm-lab-categories'],
    queryFn: () => api.get('/rm-lab-category').then(r => r.data),
  });

  const { data: params = [], isLoading: paramsLoading, refetch: refetchParams } = useQuery({
    queryKey: ['rm-required-results', selectedCategoryId],
    queryFn: () => api.get(`/rm-lab-category/required-results/${selectedCategoryId}`).then(r => r.data),
    enabled: !!selectedCategoryId,
  });

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  const addMutation = useMutation({
    mutationFn: data => api.post('/rm-lab-category/required-results', { categoryId: selectedCategoryId, ...data }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rm-required-results', selectedCategoryId] });
      setAddingParam(false);
      showSuccess('Parameter added successfully');
    },
    onError: err => setError(err?.response?.data?.error || 'Failed to add parameter'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/rm-lab-category/required-results/${id}`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rm-required-results', selectedCategoryId] });
      showSuccess('Parameter updated');
    },
    onError: err => setError(err?.response?.data?.error || 'Failed to update parameter'),
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/rm-lab-category/required-results/${id}`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rm-required-results', selectedCategoryId] });
      showSuccess('Parameter deleted');
    },
    onError: err => setError(err?.response?.data?.error || 'Failed to delete parameter'),
  });

  // Bulk seed from category's labTests
  const bulkSeedFromCategory = () => {
    if (!selectedCategory) return;
    const bulkParams = selectedCategory.labTests.map(test => ({
      paramName: test,
      isRequired: true,
    }));
    api.post('/rm-lab-category/required-results/bulk', {
      categoryId: selectedCategoryId,
      params: bulkParams,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['rm-required-results', selectedCategoryId] });
      showSuccess(`Seeded ${bulkParams.length} parameters from category definition`);
    }).catch(err => setError(err?.response?.data?.error || 'Failed to seed parameters'));
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl">
          <FlaskConical className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">RM Required Lab Results</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure required test parameters and acceptable ranges per RM category
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
          <Check className="w-4 h-4" /> {successMsg}
        </div>
      )}

      {/* Category Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
          Select RM Lab Category *
        </Label>
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <select
              value={selectedCategoryId}
              onChange={e => { setSelectedCategoryId(e.target.value); setAddingParam(false); setError(''); }}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none pr-10"
            >
              <option value="">— Select a category —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {selectedCategoryId && (
            <Button variant="outline" size="sm" onClick={() => refetchParams()} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          )}
        </div>

        {/* Category info */}
        {selectedCategory && (
          <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">{selectedCategory.name}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{selectedCategory.rmExamples}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedCategory.labTests?.map(test => (
                    <span key={test} className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                      {test}
                    </span>
                  ))}
                </div>
              </div>
              {canEdit && params.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={bulkSeedFromCategory}
                  className="shrink-0 gap-2 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                >
                  <Save className="w-3.5 h-3.5" /> Seed from Category
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Parameters Table */}
      {selectedCategoryId && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">
              Required Parameters
              <span className="ml-2 text-sm font-normal text-slate-400">({params.length} defined)</span>
            </h3>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => setAddingParam(true)}
                disabled={addingParam}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Parameter
              </Button>
            )}
          </div>

          {paramsLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    {['Parameter Name', 'Unit', 'Min', 'Max', 'Acceptable Text', 'Test Method', 'Required', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {addingParam && (
                    <NewParamForm
                      onAdd={data => addMutation.mutate(data)}
                      onCancel={() => setAddingParam(false)}
                      saving={addMutation.isPending}
                    />
                  )}
                  {params.length === 0 && !addingParam ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <FlaskConical className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-400 text-sm">No parameters configured</p>
                        {canEdit && (
                          <p className="text-slate-400 text-xs mt-1">
                            Click <strong>Add Parameter</strong> or <strong>Seed from Category</strong> to start.
                          </p>
                        )}
                      </td>
                    </tr>
                  ) : (
                    params.map(param => (
                      <ParamRow
                        key={param.id}
                        param={param}
                        canEdit={canEdit}
                        onUpdate={(id, data) => updateMutation.mutate({ id, data })}
                        onDelete={id => deleteMutation.mutate(id)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedCategoryId && (
        <div className="text-center py-20 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
          <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Select a category to view and configure its required lab result parameters</p>
        </div>
      )}
    </div>
  );
}
