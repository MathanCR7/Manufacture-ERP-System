import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { Trash2, Plus, FileText, Calendar, User, Save, ListFilter, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

export default function ProductionLossPage() {
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [users, setUsers] = useState([]);
  
  const navigate = useNavigate();

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [responsiblePersonId, setResponsiblePersonId] = useState('');
  const [productionBatchId, setProductionBatchId] = useState('');
  const [note, setNote] = useState('');

  const [productLoss, setProductLoss] = useState([]);
  const [rawMaterialLoss, setRawMaterialLoss] = useState([]);

  const [selectedBatchDetail, setSelectedBatchDetail] = useState(null);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const batchRes = await api.get('/production');
        // Filter Completed batches for loss report if wanted, or all
        setBatches(batchRes.data.batches || []);

        const masters = await api.get('/products/masters');
        setProducts(masters.data.categories || []); // Categories is actually just categories, let's get products
        setMaterials(masters.data.rawMaterials || []);
        setUsers(masters.data.users || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchDropdowns();
  }, []);

  // Fetch full batch detail and prepopulate losses with default values
  useEffect(() => {
    if (!productionBatchId) {
      setSelectedBatchDetail(null);
      setProductLoss([]);
      setRawMaterialLoss([]);
      return;
    }

    const fetchBatch = async () => {
      setLoadingBatch(true);
      try {
        const res = await api.get(`/production/${productionBatchId}`);
        setSelectedBatchDetail(res.data);

        // Prepopulate with this product
        setProductLoss([{
          productId: res.data.productId,
          productName: res.data.product?.name,
          productionQty: res.data.quantity,
          lossQty: 0,
          lossAmount: 0
        }]);

        // Prepopulate with used RMs
        if (res.data.rmUsages) {
          setRawMaterialLoss(res.data.rmUsages.map(rm => ({
            rmId: rm.rmId,
            rmName: rm.rawMaterial?.name,
            productionQty: rm.requiredQty,
            lossQty: 0,
            lossAmount: 0
          })));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingBatch(false);
      }
    };
    fetchBatch();
  }, [productionBatchId]);

  const handleProductLossChange = (index, field, val) => {
    const updated = [...productLoss];
    updated[index][field] = Number(val);
    setProductLoss(updated);
  };

  const handleMaterialLossChange = (index, field, val) => {
    const updated = [...rawMaterialLoss];
    updated[index][field] = Number(val);
    setRawMaterialLoss(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/production/loss', {
        date,
        responsiblePersonId,
        productionBatchId,
        productLoss,
        rawMaterialLoss,
        note
      });
      navigate('/production/loss-report');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit production loss report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
          <Percent className="w-6 h-6 mr-2 text-indigo-600" />
          Record Production Loss
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Record spoilage, waste, and finished product/raw material losses for a batch.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Loss Date</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Responsible Person</label>
              <select
                value={responsiblePersonId}
                onChange={(e) => setResponsiblePersonId(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select person...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, ' ')})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Production Batch</label>
              <select
                value={productionBatchId}
                onChange={(e) => setProductionBatchId(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select production batch...</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.referenceNo} - {b.product?.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Loss Note / Remarks</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Provide context for raw material wastage, lab failed conditions, or mechanical issues..."
              rows="3"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Dynamic Items Panel */}
        {loadingBatch ? (
          <div className="text-center text-slate-400 py-6">Loading batch usage details...</div>
        ) : selectedBatchDetail ? (
          <div className="space-y-6">
            {/* Product Spoilage List */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Finished Product Spoilage</h3>
                <p className="text-xs text-slate-400">Specify lost quantities for the produced finished product.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 text-xs uppercase font-medium">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3 text-right">Production Qty</th>
                      <th className="px-4 py-3 text-right">Loss Qty</th>
                      <th className="px-4 py-3 text-right">Loss Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productLoss.map((p, idx) => (
                      <tr key={p.productId}>
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{p.productName}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{p.productionQty}</td>
                        <td className="px-4 py-3 text-right w-40">
                          <Input
                            type="number"
                            min="0"
                            value={p.lossQty}
                            onChange={(e) => handleProductLossChange(idx, 'lossQty', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3 text-right w-40">
                          <Input
                            type="number"
                            min="0"
                            value={p.lossAmount}
                            onChange={(e) => handleProductLossChange(idx, 'lossAmount', e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Raw Material Wastage List */}
            {rawMaterialLoss.length > 0 && (
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Raw Material Loss</h3>
                  <p className="text-xs text-slate-400">Specify lost quantities during raw material processing.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 text-xs uppercase font-medium">
                      <tr>
                        <th className="px-4 py-3">Material</th>
                        <th className="px-4 py-3 text-right">Allocated Qty</th>
                        <th className="px-4 py-3 text-right">Loss Qty</th>
                        <th className="px-4 py-3 text-right">Loss Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawMaterialLoss.map((m, idx) => (
                        <tr key={m.rmId}>
                          <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{m.rmName}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{m.productionQty.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right w-40">
                            <Input
                              type="number"
                              min="0"
                              value={m.lossQty}
                              onChange={(e) => handleMaterialLossChange(idx, 'lossQty', e.target.value)}
                            />
                          </td>
                          <td className="px-4 py-3 text-right w-40">
                            <Input
                              type="number"
                              min="0"
                              value={m.lossAmount}
                              onChange={(e) => handleMaterialLossChange(idx, 'lossAmount', e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl shadow-md"
            >
              {submitting ? 'Recording loss report...' : 'Submit Spoilage & Loss Report'}
            </Button>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 border border-dashed rounded-2xl">
            Select a Production Batch above to record wastage details.
          </div>
        )}
      </form>
    </div>
  );
}
