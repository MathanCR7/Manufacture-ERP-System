import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  FlaskConical, ArrowLeft, Loader2, AlertTriangle, CheckCircle,
  Package, ShieldCheck, Clock, CheckCircle2, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DashboardBackButton from '@/components/ui/DashboardBackButton';

const LabInventoryUsagePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [form, setForm] = useState({
    labTestId: '',
    labItemId: '',
    quantityUsed: '',
    dateUsed: format(new Date(), 'yyyy-MM-dd'),
  });

  // Fetch lab tests (only those with testing required)
  const { data: labTests = [], isLoading: loadingLabTests } = useQuery({
    queryKey: ['grn-lab-tests-required'],
    queryFn: () => api.get('/grn/lab-results?testingRequiredOnly=true').then(r => r.data),
  });

  // Fetch lab inventory items
  const { data: labItems = [], isLoading: loadingLabItems } = useQuery({
    queryKey: ['lab-inventory'],
    queryFn: () => api.get('/lab-inventory').then(r => r.data),
  });

  // Fetch recent usage history
  const { data: recentUsages = [], isLoading: loadingUsages } = useQuery({
    queryKey: ['lab-inventory-usage-logs'],
    queryFn: () => api.get('/lab-inventory/usage').then(r => r.data),
  });

  // Filter out any materials where testing was NOT required (exempt)
  // Flatten so ONLY selective raw materials where lab test was required & done are shown
  const eligibleTestItems = useMemo(() => {
    const items = [];
    (labTests || []).forEach(lt => {
      // Find items in this lab test where testing was actually required
      const testedResults = (lt.testResults || []).filter(tr => tr.needTesting !== false);
      testedResults.forEach(tr => {
        items.push({
          key: `${lt.id}__${tr.id}`,
          labTestId: lt.id,
          testResultId: tr.id,
          grnReference: lt.grn?.referenceNo || lt.grnId?.slice(-6),
          poReference: lt.grn?.po?.referenceNo,
          supplierName: lt.grn?.po?.supplier?.name,
          rmId: tr.rmId,
          rmName: tr.rmName,
          passed: tr.passed,
          expiryDate: tr.expiryDate,
          testNotes: tr.testNotes,
          categoryParams: tr.categoryParams,
          overallDecision: lt.overallDecision,
          testedAt: lt.createdAt,
        });
      });
    });
    return items;
  }, [labTests]);

  const selectedItem = labItems.find(i => i.id === form.labItemId);
  const selectedTestItem = eligibleTestItems.find(i => i.key === selectedKey);

  const mutation = useMutation({
    mutationFn: (data) => api.post('/lab-inventory/use', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['lab-inventory-usage-logs'] });
      setSuccess('Chemical usage logged successfully! Stock has been deducted.');
      setForm(p => ({ ...p, labItemId: '', quantityUsed: '' }));
      setSelectedKey('');
    },
    onError: (err) => setError(err?.response?.data?.error || 'Failed to log usage'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.labTestId) return setError('Select a tested raw material reference');
    if (!form.labItemId) return setError('Select a lab chemical/reagent');
    if (!form.quantityUsed || Number(form.quantityUsed) <= 0) return setError('Enter a valid quantity used');

    mutation.mutate({
      labTestId: form.labTestId,
      labItemId: form.labItemId,
      quantityUsed: Number(form.quantityUsed),
      dateUsed: form.dateUsed,
    });
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5 mx-auto transition-all duration-300">
      <DashboardBackButton defaultBack="/lab-inventory/list" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FlaskConical className="w-5.5 h-5.5 text-teal-600 dark:text-teal-400 shrink-0" />
            Log Lab Chemical Usage
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Record chemical/reagent consumption exclusively for raw materials that underwent laboratory quality testing.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/lab-inventory/list')}
          className="text-xs rounded-xl h-8 gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Lab Inventory
        </Button>
      </div>

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3 text-xs animate-in fade-in duration-200">
          <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
          <p className="text-emerald-700 dark:text-emerald-400 font-bold">{success}</p>
        </div>
      )}

      {/* Info Callout if all existing items are exempt */}
      {!loadingLabTests && eligibleTestItems.length === 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider text-[11px]">
              No Lab Tests Requiring Chemical Consumption
            </h4>
            <p className="text-amber-700 dark:text-amber-300/90 leading-relaxed text-[11px]">
              Materials currently received (such as <strong>Almond</strong>, <strong>Basunthi</strong>, <strong>Berry Blast</strong>) are marked as <strong>"No Testing Required / Exempt"</strong>.
              Lab chemicals and reagents can only be logged against selective raw materials where laboratory testing was explicitly required and performed.
            </p>
          </div>
        </div>
      )}

      {/* Main Form & Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Form Card */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2.5 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-teal-500" />
              Usage Details
            </h2>

            {/* Selective Tested Raw Material */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[10px] uppercase font-bold text-slate-400 block">
                  Tested Raw Material (Lab Required Only) *
                </Label>
                {eligibleTestItems.length > 0 && (
                  <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> {eligibleTestItems.length} tested material(s) eligible
                  </span>
                )}
              </div>

              <select
                disabled={eligibleTestItems.length === 0}
                value={selectedKey}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedKey(val);
                  const match = eligibleTestItems.find(i => i.key === val);
                  setForm(p => ({ ...p, labTestId: match ? match.labTestId : '' }));
                }}
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 h-9 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {loadingLabTests
                    ? 'Loading lab test records...'
                    : eligibleTestItems.length === 0
                    ? 'No materials requiring lab testing available'
                    : 'Select tested raw material...'}
                </option>
                {eligibleTestItems.map(item => (
                  <option key={item.key} value={item.key}>
                    {item.grnReference} — Material: {item.rmName} ({item.rmId}) — Result: {item.passed ? 'Pass' : 'Fail'}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Note: Raw materials with "No Testing Required / Exempt" are automatically excluded.
              </p>
            </div>

            {/* Selected Tested Raw Material Card */}
            {selectedTestItem && (
              <div className="p-3 bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-900/40 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-teal-900 dark:text-teal-200">{selectedTestItem.rmName}</span>
                    <span className="font-mono text-[10px] bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded font-bold">
                      {selectedTestItem.rmId}
                    </span>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedTestItem.passed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                  }`}>
                    {selectedTestItem.passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {selectedTestItem.passed ? 'QC Passed' : 'QC Failed'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1 text-slate-600 dark:text-slate-400 border-t border-teal-100 dark:border-teal-900/30">
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">GRN Ref</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedTestItem.grnReference}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Supplier</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">{selectedTestItem.supplierName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Tested Date</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {selectedTestItem.testedAt ? format(new Date(selectedTestItem.testedAt), 'dd MMM yyyy') : '—'}
                    </span>
                  </div>
                </div>

                {selectedTestItem.categoryParams && Object.keys(selectedTestItem.categoryParams).length > 0 && (
                  <div className="pt-2 border-t border-teal-100 dark:border-teal-900/30">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">QC Tested Parameters:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(selectedTestItem.categoryParams).map(([k, v]) => (
                        <span key={k} className="inline-flex items-center text-[10px] bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 rounded px-1.5 py-0.5 text-teal-800 dark:text-teal-300 font-medium">
                          <strong>{k}:</strong>&nbsp;{String(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Lab Chemical / Item Used */}
            <div>
              <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                Lab Chemical / Reagent Used *
              </Label>
              <select
                value={form.labItemId}
                onChange={e => setForm(p => ({ ...p, labItemId: e.target.value }))}
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 h-9 font-semibold"
              >
                <option value="">Select chemical/reagent...</option>
                {labItems.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.itemCategory}) — Stock: {Number(i.currentStock).toFixed(2)} {i.uom}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Lab Item Preview */}
            {selectedItem && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl flex flex-wrap gap-4 text-xs font-semibold">
                <div>
                  <p className="text-[9px] text-slate-400 uppercase">Available Stock</p>
                  <p className={`font-bold mt-0.5 ${Number(selectedItem.currentStock) <= Number(selectedItem.minimumStockLevel) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                    {Number(selectedItem.currentStock).toFixed(2)} {selectedItem.uom}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 uppercase">Min. Alert Level</p>
                  <p className="text-slate-700 dark:text-slate-350 mt-0.5">{Number(selectedItem.minimumStockLevel).toFixed(2)} {selectedItem.uom}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 uppercase">Category</p>
                  <p className="text-slate-750 dark:text-slate-300 mt-0.5">{selectedItem.itemCategory}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 uppercase">Storage</p>
                  <p className="text-slate-750 dark:text-slate-300 mt-0.5">{selectedItem.storageCondition?.replace('_', ' ') || 'Room Temp'}</p>
                </div>
              </div>
            )}

            {/* Quantity & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                  Quantity Consumed {selectedItem ? `(${selectedItem.uom})` : ''} *
                </Label>
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={form.quantityUsed}
                  onChange={e => setForm(p => ({ ...p, quantityUsed: e.target.value }))}
                  placeholder="0.00"
                  className="text-xs h-9 rounded-xl"
                />
                {selectedItem && form.quantityUsed && Number(form.quantityUsed) > Number(selectedItem.currentStock) && (
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 font-bold">
                    Exceeds available stock ({Number(selectedItem.currentStock).toFixed(2)} {selectedItem.uom})!
                  </p>
                )}
              </div>
              <div>
                <Label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Date Consumed</Label>
                <Input
                  type="date"
                  value={form.dateUsed}
                  onChange={e => setForm(p => ({ ...p, dateUsed: e.target.value }))}
                  className="text-xs h-9 rounded-xl"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 rounded-xl p-3 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/lab-inventory/list')}
              className="rounded-xl h-9 text-xs px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !form.labTestId || eligibleTestItems.length === 0}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-9 text-xs px-4 active:scale-[0.98] transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5 mr-1.5" />}
              Log Chemical Consumption
            </Button>
          </div>
        </form>

        {/* Informational Sidebar */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm text-xs">
            <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              Selective QC Rule
            </h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
              Chemicals and reagents are only logged against materials that had <strong>"Testing Required"</strong> and have an official test report.
            </p>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Testing Required:
              </div>
              <p className="text-slate-500 dark:text-slate-400 pl-5">Reagents deducted from lab stock upon usage.</p>
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold pt-1">
                <XCircle className="w-3.5 h-3.5" /> No Testing / Exempt:
              </div>
              <p className="text-slate-500 dark:text-slate-400 pl-5">Excluded from chemical consumption logs automatically.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Usage Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-500" />
            Recent Chemical Consumption Logs
          </h3>
          <span className="text-[11px] text-slate-400">{recentUsages.length} total logged</span>
        </div>

        {loadingUsages ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading usage history...</div>
        ) : recentUsages.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">No chemical usage logged yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-750 bg-slate-50/60 dark:bg-slate-850/60 text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Chemical / Reagent</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Qty Consumed</th>
                  <th className="px-4 py-2.5">GRN Ref</th>
                  <th className="px-4 py-2.5">Tested Raw Material</th>
                  <th className="px-4 py-2.5">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentUsages.slice(0, 10).map(u => {
                  const testedItems = u.labTest?.testResults || [];
                  const materialNames = testedItems.map(t => t.rmName).join(', ') || u.labTest?.grn?.po?.name || '—';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">
                        {u.dateUsed ? format(new Date(u.dateUsed), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {u.labItem?.name || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800">
                          {u.labItem?.itemCategory || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">
                        {Number(u.quantityUsed).toFixed(2)} {u.labItem?.uom}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-650 dark:text-slate-300 whitespace-nowrap">
                        {u.labTest?.grn?.referenceNo || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap">
                        {materialNames}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {u.user?.name || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LabInventoryUsagePage;
