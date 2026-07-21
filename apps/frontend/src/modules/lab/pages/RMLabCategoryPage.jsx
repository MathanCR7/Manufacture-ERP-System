import React, { useState, useEffect } from 'react';
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
import { Pagination } from '@/components/ui/Pagination';

const CATEGORY_BADGE_COLORS = [
  'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  'bg-violet-500/10 text-violet-750 dark:text-violet-400 border border-violet-500/20',
  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20',
  'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
  'bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20',
  'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
  'bg-amber-500/10 text-amber-600 dark:text-amber-450 border border-amber-500/20',
  'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20',
  'bg-rose-500/10 text-rose-600 dark:text-rose-455 border border-rose-500/20',
  'bg-indigo-500/10 text-indigo-705 dark:text-indigo-400 border border-indigo-500/20',
  'bg-lime-500/10 text-lime-650 dark:text-lime-400 border border-lime-500/20',
  'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
  'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-500/20',
  'bg-yellow-500/10 text-yellow-600 dark:text-yellow-450 border border-yellow-500/20',
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
    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Category Name *</Label>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Dairy RM" className="text-xs h-9 rounded-xl" />
        </div>
        <div>
          <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Code *</Label>
          <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. DAIRY_RM" className="text-xs h-9 font-mono rounded-xl" />
        </div>
      </div>
      <div>
        <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
          Lab Tests * <span className="text-[9px] text-slate-400 font-normal">(comma-separated: Fat %, SNF, Acidity)</span>
        </Label>
        <Input value={form.labTests} onChange={e => setForm(p => ({ ...p, labTests: e.target.value }))} placeholder="Fat %, SNF, Acidity, Protein" className="text-xs h-9 rounded-xl" />
      </div>
      <div>
        <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Acceptable Results *</Label>
        <textarea
          value={form.acceptableResults}
          onChange={e => setForm(p => ({ ...p, acceptableResults: e.target.value }))}
          rows={2}
          placeholder="Fat as per spec, SNF >8.5%, Low acidity, Coliform absent"
          className="w-full border border-slate-205 dark:border-slate-800 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">RM Examples</Label>
          <Input value={form.rmExamples} onChange={e => setForm(p => ({ ...p, rmExamples: e.target.value }))} placeholder="Milk, Cream, SMP, Butter" className="text-xs h-9 rounded-xl" />
        </div>
        <div>
          <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Description</Label>
          <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" className="text-xs h-9 rounded-xl" />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 h-8 rounded-xl text-xs px-3">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          {initial?.id ? 'Update' : 'Create'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="gap-1 h-8 rounded-xl text-xs px-3">
          <X className="w-3 h-3" /> Cancel
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden hover:shadow transition-all duration-200">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colorClass}`}>{cat.code}</span>
              <h3 className="font-bold text-slate-900 dark:text-white text-xs">{cat.name}</h3>
            </div>
            {cat.rmExamples && (
              <p className="text-[10px] text-slate-450 truncate font-semibold">{cat.rmExamples}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && (
              <button
                onClick={() => onEdit(cat)}
                className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                title="Edit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-105 dark:hover:bg-slate-800 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Lab tests pills */}
        <div className="flex flex-wrap gap-1 mt-2.5">
          {cat.labTests?.map(test => (
            <span key={test} className="text-[10px] px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-650 dark:text-slate-400 font-bold border border-slate-100 dark:border-slate-850">
              {test}
            </span>
          ))}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50/40 dark:bg-slate-900/40 space-y-3 text-[11px]">
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Acceptable Results</p>
            <p className="text-slate-700 dark:text-slate-300 font-medium">{cat.acceptableResults}</p>
          </div>
          {cat.rmExamples && (
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">RM Examples</p>
              <p className="text-slate-600 dark:text-slate-400 font-medium">{cat.rmExamples}</p>
            </div>
          )}
          {cat.description && (
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Description</p>
              <p className="text-slate-600 dark:text-slate-400 font-medium">{cat.description}</p>
            </div>
          )}
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Required Result Params</p>
            <p className="text-slate-500 dark:text-slate-450 font-bold">
              {cat.requiredResults?.length > 0
                ? `${cat.requiredResults.length} param(s) configured`
                : 'No params configured — default tests used.'}
            </p>
          </div>
          <p className="text-[9px] text-slate-400 font-semibold">Updated: {cat.updatedAt ? format(new Date(cat.updatedAt), 'dd MMM yyyy HH:mm') : '—'}</p>
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
  const [editCat, setEditCat] = useState(null);
  const [error, setError] = useState('');
  const [seedMsg, setSeedMsg] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  const { data: categories = [], isLoading, refetch } = useQuery({
    queryKey: ['rm-lab-categories'],
    queryFn: () => api.get('/rm-lab-category').then(r => r.data),
  });

  // Reset pagination to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

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
      setSeedMsg(`Seeded ${created} new category templates.`);
      setTimeout(() => setSeedMsg(''), 5000);
    },
    onError: () => setError('Failed to seed default categories'),
  });

  const filtered = categories.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.code?.toLowerCase().includes(search.toLowerCase()) ||
    c.rmExamples?.toLowerCase().includes(search.toLowerCase())
  );

  // Pagination calculation
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedCategories = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 dark:bg-violet-500/20 rounded-xl">
            <FlaskConical className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">RM Lab Category Setup</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{categories.length} raw material test classes defined</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
          {canEdit && categories.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="gap-1.5 text-xs rounded-xl h-8 text-slate-700 border-slate-205"
            >
              {seedMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              Seed Defaults
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs rounded-xl h-8 border-slate-205">
            <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" /> Refresh
          </Button>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => { setAddMode(true); setEditCat(null); setError(''); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs rounded-xl h-8 font-semibold active:scale-[0.98] transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Category
            </Button>
          )}
        </div>
      </div>

      {/* Notifications / Errors */}
      {seedMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" /> {seedMsg}
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-600 dark:text-rose-455 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto text-sm font-bold">×</button>
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
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 p-3 rounded-2xl shadow-sm relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-6 top-1/2 -translate-y-1/2" />
        <Input
          placeholder="Search categories by name, code representation, or examples..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 h-9 text-xs w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      {/* Category Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : paginatedCategories.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <FlaskConical className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-50" />
          <p className="text-slate-550 font-bold text-sm">No RM lab categories found</p>
          {canEdit && categories.length === 0 && (
            <p className="text-xs text-slate-405 mt-1">
              Click <strong>Seed Defaults</strong> above to populate.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Inline edit form */}
          {editCat && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Editing: {editCat.name}</p>
              <CategoryEditForm
                initial={editCat}
                onSave={data => updateMutation.mutate({ id: editCat.id, data })}
                onCancel={() => setEditCat(null)}
                saving={updateMutation.isPending}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedCategories.map((cat, idx) => (
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

          {/* Grid pagination control */}
          {totalPages > 1 && (
            <div className="pt-2 flex justify-between items-center border-t border-slate-200 dark:border-slate-800 flex-col sm:flex-row gap-3">
              <p className="text-[11px] text-slate-550 font-semibold">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} categories
              </p>
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>
          )}
        </div>
      )}

      {/* Reference Table (Compact style) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-violet-550 shrink-0" /> Standard Raw Material Testing Standards
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-left">
            <thead className="bg-slate-50/60 dark:bg-slate-850/50 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800 uppercase tracking-widest">
              <tr>
                {['RM Class', 'Common Examples', 'Primary Lab Checks', 'Approved Ranges'].map(h => (
                  <th key={h} className="px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                { cat: 'Dairy RM', ex: 'Milk, Cream, SMP, Butter, Whey Powder', tests: 'Fat %, SNF, Acidity, MBRT, TPC, Coliform', result: 'Fat as per spec, SNF >8.5%, Low acidity' },
                { cat: 'Milk Powder', ex: 'SMP, Whole Milk Powder', tests: 'Moisture, Solubility, Protein, Microbial Test', result: 'Moisture <5%, Good solubility' },
                { cat: 'Fat RM', ex: 'Butter Oil, Cream Fat', tests: 'Fat %, FFA, Peroxide Value', result: 'High purity fat, FFA <0.2%' },
                { cat: 'Nut RM', ex: 'Cashew, Almond, Pistachio, Peanut', tests: 'Moisture, Aflatoxin, Mold, Odor', result: 'Aflatoxin negative, mold free' },
                { cat: 'Sweetener RM', ex: 'Sugar, Glucose Syrup, Corn Syrup', tests: 'Purity, Moisture, Brix, Color', result: 'High purity, Brix standard' },
                { cat: 'Water RM', ex: 'RO Water, Process Water', tests: 'pH, TDS, Hardness, E.coli', result: 'E.coli absent, TDS as per limits' },
                { cat: 'Packaging RM', ex: 'Cups, Lids, Wrappers', tests: 'Migration Test, Cleanliness', result: 'Food-grade safe' },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                  <td className="px-4 py-2 font-bold text-slate-850 dark:text-slate-200">{row.cat}</td>
                  <td className="px-4 py-2 text-slate-500 font-semibold">{row.ex}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.tests.split(', ').map(t => (
                        <span key={t} className="px-1.5 py-0.2 bg-violet-500/10 text-violet-700 dark:text-violet-400 rounded-md font-bold text-[10px] border border-violet-500/10">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-500 font-medium max-w-xs truncate">{row.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
