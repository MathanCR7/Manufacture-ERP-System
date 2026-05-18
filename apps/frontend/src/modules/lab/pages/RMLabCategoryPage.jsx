import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { format } from 'date-fns';
import {
  FlaskConical, Plus, Edit2, Check, X, Loader2, Search,
  ChevronDown, ChevronUp, Tag, Database, RefreshCw, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import useAuthStore from '@/app/store/authStore';

const CATEGORY_BADGE_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
  'bg-lime-100 text-lime-700 dark:bg-lime-500/20 dark:text-lime-400',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-400',
  'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
];

// Inline Edit Form
function CategoryEditForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    code: initial?.code || '',
    labTests: initial?.labTests?.join(', ') || '',
    acceptableResults: initial?.acceptableResults || '',
    rmExamples: initial?.rmExamples || '',
    description: initial?.description || '',
  });

  const handleSave = () => {
    if (!form.name || !form.code || !form.labTests || !form.acceptableResults) return;
    onSave({
      name: form.name.trim(),
      code: form.code.trim().toUpperCase().replace(/\s+/g, '_'),
      labTests: form.labTests.split(',').map(t => t.trim()).filter(Boolean),
      acceptableResults: form.acceptableResults.trim(),
      rmExamples: form.rmExamples.trim() || undefined,
      description: form.description.trim() || undefined,
    });
  };

  return (
    <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-indigo-200 dark:border-indigo-500/30 rounded-xl space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Category Name *</Label>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Dairy RM" className="text-sm h-9" />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Code *</Label>
          <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. DAIRY_RM" className="text-sm h-9 font-mono" />
        </div>
      </div>
      <div>
        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
          Lab Tests * <span className="text-slate-400 font-normal">(comma-separated: Fat %, SNF, Acidity)</span>
        </Label>
        <Input value={form.labTests} onChange={e => setForm(p => ({ ...p, labTests: e.target.value }))} placeholder="Fat %, SNF, Acidity, Protein, MBRT, TPC, Coliform" className="text-sm h-9" />
      </div>
      <div>
        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Acceptable Results *</Label>
        <textarea
          value={form.acceptableResults}
          onChange={e => setForm(p => ({ ...p, acceptableResults: e.target.value }))}
          rows={2}
          placeholder="Fat as per spec, SNF >8.5%, Low acidity, Coliform absent"
          className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">RM Examples</Label>
          <Input value={form.rmExamples} onChange={e => setForm(p => ({ ...p, rmExamples: e.target.value }))} placeholder="Milk, Cream, SMP, Butter" className="text-sm h-9" />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Description</Label>
          <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" className="text-sm h-9" />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {initial?.id ? 'Update' : 'Create'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="gap-1.5">
          <X className="w-3.5 h-3.5" /> Cancel
        </Button>
      </div>
    </div>
  );
}

// Category Card
function CategoryCard({ cat, idx, canEdit, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = CATEGORY_BADGE_COLORS[idx % CATEGORY_BADGE_COLORS.length];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colorClass}`}>{cat.code}</span>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">{cat.name}</h3>
            </div>
            {cat.rmExamples && (
              <p className="text-xs text-slate-400 truncate">{cat.rmExamples}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {canEdit && (
              <button
                onClick={() => onEdit(cat)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                title="Edit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Lab tests pills */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {cat.labTests?.map(test => (
            <span key={test} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium border border-slate-200 dark:border-slate-700">
              {test}
            </span>
          ))}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-800/40 space-y-3 text-sm">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Acceptable Results</p>
            <p className="text-slate-700 dark:text-slate-300">{cat.acceptableResults}</p>
          </div>
          {cat.rmExamples && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">RM Examples</p>
              <p className="text-slate-600 dark:text-slate-400">{cat.rmExamples}</p>
            </div>
          )}
          {cat.description && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Description</p>
              <p className="text-slate-600 dark:text-slate-400">{cat.description}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Required Result Params</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              {cat.requiredResults?.length > 0
                ? `${cat.requiredResults.length} param(s) defined`
                : 'No params configured — go to RM Required Lab Results to add.'}
            </p>
          </div>
          <p className="text-xs text-slate-400">Updated: {cat.updatedAt ? format(new Date(cat.updatedAt), 'dd MMM yyyy HH:mm') : '—'}</p>
        </div>
      )}
    </div>
  );
}

export default function RMLabCategoryPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const canEdit = ['MAIN_MASTER', 'LAB_ASSISTANT'].includes(user?.role);

  const [search, setSearch] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [editCat, setEditCat] = useState(null); // category being edited
  const [error, setError] = useState('');
  const [seedMsg, setSeedMsg] = useState('');

  const { data: categories = [], isLoading, refetch } = useQuery({
    queryKey: ['rm-lab-categories'],
    queryFn: () => api.get('/rm-lab-category').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: data => api.post('/rm-lab-category', data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rm-lab-categories'] }); setAddMode(false); setError(''); },
    onError: err => setError(err?.response?.data?.error || 'Failed to create category'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/rm-lab-category/${id}`, data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rm-lab-categories'] }); setEditCat(null); setError(''); },
    onError: err => setError(err?.response?.data?.error || 'Failed to update category'),
  });

  const seedMutation = useMutation({
    mutationFn: () => api.post('/rm-lab-category/seed-defaults').then(r => r.data),
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['rm-lab-categories'] });
      const created = data.results?.filter(r => r.action === 'created').length || 0;
      setSeedMsg(`Seeded ${created} new categorie(s). ${data.results?.filter(r => r.action === 'exists').length || 0} already existed.`);
      setTimeout(() => setSeedMsg(''), 5000);
    },
    onError: () => setError('Failed to seed default categories'),
  });

  const filtered = categories.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.code?.toLowerCase().includes(search.toLowerCase()) ||
    c.rmExamples?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 dark:bg-violet-500/20 rounded-xl">
            <FlaskConical className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">RM Lab Category</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{categories.length} categories · Category-specific test parameters for raw materials</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && categories.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="gap-2 text-sm"
            >
              {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              Seed Defaults
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => { setAddMode(true); setEditCat(null); setError(''); }}
              className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Category
            </Button>
          )}
        </div>
      </div>

      {/* Seed notification */}
      {seedMsg && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <Check className="w-4 h-4" /> {seedMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Add form */}
      {addMode && (
        <CategoryEditForm
          initial={null}
          onSave={data => createMutation.mutate(data)}
          onCancel={() => setAddMode(false)}
          saving={createMutation.isPending}
        />
      )}

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          placeholder="Search by name, code, or examples..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Category Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No RM lab categories found</p>
          {canEdit && categories.length === 0 && (
            <p className="text-sm text-slate-400 mt-2">
              Click <strong>Seed Defaults</strong> to load the 14 standard RM categories.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Inline edit form */}
          {editCat && (
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Editing: <strong>{editCat.name}</strong></p>
              <CategoryEditForm
                initial={editCat}
                onSave={data => updateMutation.mutate({ id: editCat.id, data })}
                onCancel={() => setEditCat(null)}
                saving={updateMutation.isPending}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((cat, idx) => (
              editCat?.id === cat.id ? null : (
                <CategoryCard
                  key={cat.id}
                  cat={cat}
                  idx={idx}
                  canEdit={canEdit}
                  onEdit={c => { setEditCat(c); setAddMode(false); }}
                />
              )
            ))}
          </div>
        </>
      )}

      {/* Reference Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Tag className="w-4 h-4 text-violet-500" /> Standard RM Lab Test Reference
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                {['RM Category', 'RM Examples', 'Important Lab Tests', 'Acceptable Results'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                { cat: 'Dairy RM', ex: 'Milk, Cream, SMP, Butter, Whey Powder', tests: 'Fat %, SNF, Acidity, Protein, MBRT, TPC, Coliform', result: 'Fat as per spec, SNF >8.5%, Low acidity, Coliform absent' },
                { cat: 'Milk Powder', ex: 'SMP, Whole Milk Powder', tests: 'Moisture, Solubility, Protein, Microbial Test', result: 'Moisture <5%, Good solubility, No contamination' },
                { cat: 'Fat RM', ex: 'Butter Oil, Cream Fat', tests: 'Fat %, FFA, Peroxide Value', result: 'High purity fat, No rancidity' },
                { cat: 'Nut RM', ex: 'Cashew, Almond, Pistachio, Peanut', tests: 'Moisture, Aflatoxin, Mold, Odor', result: 'Aflatoxin absent, Low moisture, Fresh smell' },
                { cat: 'Sweetener RM', ex: 'Sugar, Glucose Syrup, Corn Syrup', tests: 'Purity, Moisture, Brix, Color', result: 'High purity, Clear color' },
                { cat: 'Cocoa & Chocolate RM', ex: 'Cocoa Powder, Chocolate Paste', tests: 'Fat %, Moisture, Flavor, Microbial', result: 'Rich cocoa flavor, Low moisture' },
                { cat: 'Fruit RM', ex: 'Mango Pulp, Strawberry Pulp, Banana Puree', tests: 'pH, Brix, Microbial, Preservatives', result: 'Correct sweetness, Low bacteria' },
                { cat: 'Stabilizer RM', ex: 'Guar Gum, CMC, Carrageenan', tests: 'Viscosity, Moisture, Solubility', result: 'Stable viscosity, Good hydration' },
                { cat: 'Emulsifier RM', ex: 'Mono Diglycerides', tests: 'Emulsification Test, Purity', result: 'Stable emulsion' },
                { cat: 'Flavor RM', ex: 'Vanilla, Butterscotch, Chocolate Flavor', tests: 'Aroma, Stability, pH', result: 'Strong stable flavor' },
                { cat: 'Color RM', ex: 'Natural/Permitted Food Colors', tests: 'Shade Check, Stability', result: 'Uniform color' },
                { cat: 'Water RM', ex: 'RO Water, Process Water', tests: 'pH, TDS, Hardness, TPC, E.coli', result: 'E.coli absent, Safe potable quality' },
                { cat: 'Packaging RM', ex: 'Cups, Lids, Wrappers', tests: 'Migration Test, Cleanliness', result: 'Food-grade safe' },
                { cat: 'Add-on RM', ex: 'Choco Chips, Cookies, Candy Pieces', tests: 'Moisture, Texture, Microbial', result: 'Crispy, contamination-free' },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200">{row.cat}</td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{row.ex}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                    <div className="flex flex-wrap gap-1">
                      {row.tests.split(', ').map(t => (
                        <span key={t} className="px-1.5 py-0.5 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 rounded text-xs">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 max-w-xs">{row.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
