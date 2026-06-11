import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { Factory, Calendar, Info, Layers, Users, TrendingUp, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import { useLocation, useNavigate } from 'react-router-dom';

export default function AddProductionPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // State pre-populated from navigation location.state if existing
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(location.state?.productId || '');
  const [quantity, setQuantity] = useState(location.state?.quantity || 1);
  const [productionType, setProductionType] = useState(location.state?.orderId ? 'Make to Order' : 'Make to Stock');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [completeDate, setCompleteDate] = useState('');
  const [expiryDays, setExpiryDays] = useState(365);
  const [note, setNote] = useState('');
  const [orderId, setOrderId] = useState(location.state?.orderId || '');
  
  // BOM details expansion
  const [bomDetails, setBomDetails] = useState(null);
  const [bomLoading, setBomLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');

  // Fetch dropdown master options
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const res = await api.get('/products');
        setProducts(res.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMasters();
  }, []);

  // Fetch BOM expansion on productId/qty change
  useEffect(() => {
    if (!selectedProductId || quantity <= 0) {
      setBomDetails(null);
      return;
    }
    const expandBom = async () => {
      setBomLoading(true);
      setErrorBanner('');
      try {
        const res = await api.post(`/products/${selectedProductId}/bom/expand?qty=${quantity}`);
        setBomDetails(res.data);

        // Check if any RM is insufficient
        const hasInsufficient = res.data.items.some(item => item.status === 'Insufficient');
        if (hasInsufficient) {
          setErrorBanner('INSUFFICIENT STOCK: Raw material stock is insufficient for this batch. Production can still be submitted, but raw material stock will be locked/depleted.');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setBomLoading(false);
      }
    };

    const timer = setTimeout(expandBom, 300);
    return () => clearTimeout(timer);
  }, [selectedProductId, quantity]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorBanner('');
    try {
      await api.post('/production', {
        productId: selectedProductId,
        productionType,
        startDate,
        completeDate: completeDate || undefined,
        expiryDays,
        quantity,
        note,
        orderId: orderId || undefined
      });
      navigate('/production/batches');
    } catch (err) {
      setErrorBanner(err.response?.data?.error || 'Failed to schedule production batch');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <Button variant="ghost" onClick={() => navigate('/production/batches')} className="p-2">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <Factory className="w-6 h-6 mr-2 text-indigo-600" />
            Schedule New Production
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Define a finished product batch, scale consumption, and reserve raw material stocks.
          </p>
          {orderId && (
            <span className="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/35 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Linked Customer Order: {orderId}
            </span>
          )}
        </div>
      </div>

      {errorBanner && (
        <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
          errorBanner.includes('INSUFFICIENT')
            ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-400'
            : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400'
        }`}>
          <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm font-medium">{errorBanner}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form panel */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Finished Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select product to manufacture...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Production Type</label>
                <select
                  value={productionType}
                  onChange={(e) => setProductionType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Make to Stock">Make to Stock</option>
                  <option value="Make to Order">Make to Order</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Quantity to Produce</label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  required
                />
              </div>

              <DatePicker
                label="Start Date"
                required
                value={startDate ? new Date(startDate) : null}
                onChange={(date) => setStartDate(date ? date.toISOString().split('T')[0] : '')}
                modalTitle="Start Date"
                placeholder="Select Date"
                className="space-y-1"
                labelClassName="text-xs font-semibold text-slate-500 uppercase block"
                triggerClassName="h-10 text-sm"
              />

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Expiry Duration (Days)</label>
                <Input
                  type="number"
                  min="1"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Note / Remarks</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Specific instructions, stage adjustments, or batch references..."
                rows="3"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting || !selectedProductId}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl shadow-md font-semibold"
            >
              {submitting ? 'Submitting Batch...' : 'Confirm & Schedule Batch'}
            </Button>
          </form>
        </div>

        {/* Bill of Materials expand check panel */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-4">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center">
              <Layers className="w-5 h-5 mr-1.5 text-indigo-500" /> Bill of Materials Expansion
            </h3>
            <p className="text-xs text-slate-400">Live stock check based on quantity selected.</p>
          </div>

          {bomLoading ? (
            <div className="text-sm text-slate-400 py-6 text-center">Calculating BOM requirements...</div>
          ) : bomDetails ? (
            <div className="space-y-3">
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl flex justify-between items-center text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                <span>Total Materials Cost:</span>
                <span>₹{Number(bomDetails.totalRmCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {bomDetails.items.map(item => (
                  <div key={item.id} className="p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl flex flex-col space-y-1 shadow-2xs">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-slate-850 dark:text-slate-200">{item.rawMaterialName}</span>
                      <span className={`px-2 py-0.5 text-3xs font-bold rounded-full ${
                        item.status === 'Sufficient'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 animate-pulse'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-2xs text-slate-400">
                      <span>Needed: {item.requiredQty.toFixed(2)}</span>
                      <span>Stock: {item.availableStock.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-12 text-center">
              Please select a Finished Product and specify batch size to view scaled material checks.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
