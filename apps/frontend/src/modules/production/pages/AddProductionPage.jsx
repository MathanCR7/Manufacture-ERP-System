import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  Factory, Calendar, Info, Layers, Users, TrendingUp, ChevronLeft, 
  ShoppingBag, ShieldAlert, Award, Flame, CheckCircle, Play, Save 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

export default function AddProductionPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Master Lists
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  // Production Type Selection: 'Order-Based' | 'Replenishment' | 'Manual'
  const [triggerType, setTriggerType] = useState('Manual');

  // Form Fields
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDays, setExpiryDays] = useState(365);
  const [note, setNote] = useState('');

  // Type 1 Fields (Order-Based)
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [customerOrderQty, setCustomerOrderQty] = useState(0);
  const [minHoldStock, setMinHoldStock] = useState(0);
  const [currentStock, setCurrentStock] = useState(0);
  const [suggestedQuantity, setSuggestedQuantity] = useState(0);

  // Type 2 Fields (Stock Replenishment)
  const [replenishmentShortfall, setReplenishmentShortfall] = useState(0);
  const [targetStockLevel, setTargetStockLevel] = useState(100);

  // Type 3 Fields (Manual)
  const [reasonOccasion, setReasonOccasion] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('');

  // BOM expansion details
  const [bomDetails, setBomDetails] = useState(null);
  const [bomLoading, setBomLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shortfallError, setShortfallError] = useState('');

  // Sidebar Tab selection: 'bom' | 'sop'
  const [sidebarTab, setSidebarTab] = useState('bom');

  // Get active product details (for SOP steps display)
  const activeProduct = products.find(p => p.id === selectedProductId);

  // Fetch dropdown master options
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const prodRes = await api.get('/products');
        setProducts(prodRes.data || []);

        const orderRes = await api.get('/orders');
        // Filter orders waiting for production or confirmed
        const openOrders = (orderRes.data || []).filter(o => 
          o.status === 'Confirmed' || o.status === 'Waiting for Production'
        );
        setOrders(openOrders);

        // Prepopulate from navigation
        if (location.state?.productId) {
          setSelectedProductId(location.state.productId);
          if (location.state.orderId) {
            setTriggerType('Order-Based');
            setSelectedOrderId(location.state.orderId);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchMasters();
  }, [location.state]);

  // Load product specific parameters (stock levels & current stock)
  useEffect(() => {
    if (!selectedProductId) return;

    const loadProductStats = async () => {
      try {
        const prod = products.find(p => p.id === selectedProductId);
        if (!prod) return;

        // Fetch detailed stock stats
        const stockRes = await api.get('/products/stock');
        const stockInfo = (stockRes.data || []).find(s => s.id === selectedProductId);
        
        const currStockVal = stockInfo ? Number(stockInfo.currentStock) : Number(prod.currentStock || 0);
        const minHoldVal = prod.stockLevels?.[0]?.minLevel ? Number(prod.stockLevels[0].minLevel) : Number(prod.alertLevel || 0);
        
        setCurrentStock(currStockVal);
        setMinHoldStock(minHoldVal);

        if (triggerType === 'Replenishment') {
          const shortfall = Math.max(0, minHoldVal - currStockVal);
          setReplenishmentShortfall(shortfall);
          setTargetStockLevel(minHoldVal + 50); // suggest safety buffer
          setQuantity(Math.max(1, (minHoldVal + 50) - currStockVal));
        }
      } catch (e) {
        console.error('Error loading product stats', e);
      }
    };

    loadProductStats();
  }, [selectedProductId, triggerType, products]);

  // Handle Order Selection in Order-Based
  useEffect(() => {
    if (triggerType !== 'Order-Based' || !selectedOrderId) return;

    const ord = orders.find(o => o.id === selectedOrderId);
    if (!ord) return;

    // Sum matching items in the order
    let orderQty = 0;
    if (selectedProductId) {
      const matchItem = ord.items?.find(it => it.productId === selectedProductId);
      if (matchItem) orderQty = Number(matchItem.quantity);
    } else if (ord.items?.[0]) {
      // Pick first item if no product is selected
      setSelectedProductId(ord.items[0].productId);
      orderQty = Number(ord.items[0].quantity);
    }

    setCustomerOrderQty(orderQty);

    // Suggest quantity = (Order Quantity - Current Stock) + Minimum Hold Stock
    const suggested = Math.max(0, (orderQty - currentStock) + minHoldStock);
    setSuggestedQuantity(suggested);
    setQuantity(suggested);
  }, [selectedOrderId, selectedProductId, currentStock, minHoldStock, triggerType, orders]);

  // Adjust suggested quantity based on target stock in Replenishment
  useEffect(() => {
    if (triggerType !== 'Replenishment') return;
    const needed = Math.max(1, targetStockLevel - currentStock);
    setQuantity(needed);
  }, [targetStockLevel, currentStock, triggerType]);

  // Fetch BOM expansion on product or quantity change
  useEffect(() => {
    if (!selectedProductId || quantity <= 0) {
      setBomDetails(null);
      return;
    }
    const expandBom = async () => {
      setBomLoading(true);
      setShortfallError('');
      try {
        const res = await api.post(`/products/${selectedProductId}/bom/expand?qty=${quantity}`);
        setBomDetails(res.data);

        // Check if any RM is insufficient
        const hasInsufficient = res.data.items.some(item => item.status === 'Insufficient');
        if (hasInsufficient) {
          const names = res.data.items
            .filter(item => item.status === 'Insufficient')
            .map(item => `${item.rawMaterialName} (Shortfall: ${(item.requiredQty - item.availableStock).toFixed(2)})`)
            .join(', ');
          setShortfallError(`RM Shortfall: ${names}. Batch scheduling will block start-execution.`);
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

  const handleSubmit = async (e, immediateStart = false) => {
    if (e) e.preventDefault();
    const isDark = document.documentElement.classList.contains('dark');

    if (quantity <= 0) {
       Swal.fire({
         title: '<span class="text-sm font-bold text-rose-600 dark:text-rose-450">Invalid Quantity</span>',
         html: '<p class="text-xs text-slate-500 mt-1">Production batch yield quantity must be greater than 0.</p>',
         icon: 'error',
         confirmButtonText: 'Close',
         confirmButtonColor: '#ef4444',
         background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
         color: isDark ? '#f8fafc' : '#0f172a',
       });
       return;
    }

    // Enforce shortfall blocks
    const hasInsufficient = bomDetails?.items?.some(item => item.status === 'Insufficient');
    if (hasInsufficient) {
      Swal.fire({
        title: '<span class="text-sm font-bold text-rose-600 dark:text-rose-400">Start Blocked!</span>',
        html: '<p class="text-xs text-slate-500 mt-1">Cannot schedule production. One or more raw materials are insufficient. Reorder materials or adjust yield size.</p>',
        icon: 'error',
        confirmButtonText: 'Close',
        confirmButtonColor: '#ef4444',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });
      return;
    }

    setSubmitting(true);
    try {
      const typeLabel = triggerType === 'Order-Based' ? 'Make to Order' : 'Make to Stock';
      
      const payload = {
        productId: selectedProductId,
        productionType: typeLabel,
        status: immediateStart ? 'In Progress' : 'Planned',
        startDate,
        expiryDays,
        quantity,
        note: `Trigger Type: ${triggerType}. ${note} ${reasonOccasion ? `Reason: ${reasonOccasion}.` : ''} ${authorizedBy ? `Authorized by: ${authorizedBy}.` : ''}`,
        orderId: triggerType === 'Order-Based' ? selectedOrderId : undefined
      };

      await api.post('/production', payload);

      // If Order-Based, update customer order status to 'In Production'
      if (triggerType === 'Order-Based' && selectedOrderId) {
        await api.patch(`/orders/${selectedOrderId}/status`, { status: 'In Production' });
      }

      Swal.fire({
        title: `<span class="text-sm font-bold text-slate-800 dark:text-slate-100">${immediateStart ? 'Batch Started!' : 'Batch Planned!'}</span>`,
        text: immediateStart 
          ? 'The batch has been created and started directly. Raw materials reserved.' 
          : 'The production batch has been successfully scheduled.',
        icon: 'success',
        confirmButtonColor: '#4f46e5',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });
      navigate('/production/batches');
    } catch (err) {
      Swal.fire({
        title: '<span class="text-sm font-bold">Failed to Create Batch</span>',
        text: err.response?.data?.error || 'Failed to submit batch.',
        icon: 'error',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300 animate__animated animate__fadeIn">
      {/* Header bar */}
      <div className="flex items-center space-x-3 pb-4 border-b border-slate-205 dark:border-slate-800">
        <Button variant="ghost" onClick={() => navigate(-1)} className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-350" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <Factory className="w-5 h-5 mr-2 text-indigo-650" />
            Schedule New Production
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor raw material stocks in real-time, view saved recipe SOP steps, and trigger immediate batch execution.
          </p>
        </div>
      </div>

      {/* Production Trigger Selection Buttons */}
      <div className="grid grid-cols-3 gap-3 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800 max-w-xl shadow-2xs">
        {[
          { type: 'Order-Based', label: 'Order-Based (Type 1)' },
          { type: 'Replenishment', label: 'Replenishment (Type 2)' },
          { type: 'Manual', label: 'Manual / Seasonal (Type 3)' }
        ].map(node => (
          <button
            key={node.type}
            type="button"
            onClick={() => { setTriggerType(node.type); setSelectedProductId(''); }}
            className={`py-2 text-xs font-bold rounded-xl transition-all ${
              triggerType === node.type
                ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-sm border border-slate-200/30 dark:border-slate-750'
                : 'text-slate-505 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            {node.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Details Panel */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={(e) => handleSubmit(e, false)} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-205 dark:border-slate-800 shadow-md space-y-5">
            
            {/* Conditional Type 1 Fields */}
            {triggerType === 'Order-Based' && (
              <div className="p-4 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-2xs font-extrabold text-indigo-650 dark:text-indigo-400 uppercase block">Linked Customer Order *</label>
                  <select
                    required
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-850 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-10"
                  >
                    <option value="">Select Customer Order...</option>
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>{o.referenceNo} - {o.customer?.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-2xs font-extrabold text-indigo-650 dark:text-indigo-400 uppercase block">Product Name *</label>
                  <select
                    required
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-850 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-10"
                  >
                    <option value="">Select product to produce...</option>
                    {selectedOrderId && orders.find(o => o.id === selectedOrderId)?.items?.map(it => (
                      <option key={it.productId} value={it.productId}>{it.product?.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:col-span-2 text-center text-xs">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Order Qty</p>
                    <p className="font-bold text-slate-800 dark:text-white">{customerOrderQty} pcs</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Current Stock</p>
                    <p className="font-bold text-slate-800 dark:text-white">{currentStock} pcs</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Min Buffer Stock</p>
                    <p className="font-bold text-slate-800 dark:text-white">{minHoldStock} pcs</p>
                  </div>
                </div>

                <div className="sm:col-span-2 p-3 bg-indigo-600/10 dark:bg-indigo-950/20 rounded-xl border border-indigo-100/50 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-indigo-700 dark:text-indigo-400">System Suggested Batch Yield</p>
                    <p className="text-[10px] text-slate-450 dark:text-slate-400">Yield = (Order - Current) + Min Buffer</p>
                  </div>
                  <span className="font-mono font-bold text-base text-indigo-650 dark:text-indigo-400">
                    {suggestedQuantity > 0 ? `${suggestedQuantity} pcs` : '0 pcs (Sufficient Stock)'}
                  </span>
                </div>
              </div>
            )}

            {/* Conditional Type 2 Fields */}
            {triggerType === 'Replenishment' && (
              <div className="p-4 bg-amber-50/10 dark:bg-amber-950/10 rounded-2xl border border-amber-100/50 dark:border-amber-900/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-2xs font-extrabold text-amber-705 dark:text-amber-400 uppercase block">Select Product *</label>
                  <select
                    required
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-850 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-10"
                  >
                    <option value="">Select product to replenish...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Current Stock</p>
                    <p className="font-bold text-slate-800 dark:text-white">{currentStock} pcs</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Minimum Hold</p>
                    <p className="font-bold text-slate-800 dark:text-white">{minHoldStock} pcs</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-rose-600 dark:text-rose-450 font-bold">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Shortfall</p>
                    <p>{replenishmentShortfall} pcs</p>
                  </div>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-2xs font-extrabold text-slate-500 uppercase block">Target Stock After Production (Target Level)</label>
                  <Input
                    type="number"
                    min={minHoldStock + 1}
                    value={targetStockLevel}
                    onChange={(e) => setTargetStockLevel(Number(e.target.value) || 0)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 rounded-xl"
                  />
                  <p className="text-[10px] text-slate-400">Target stock must be greater than minimum hold stock level.</p>
                </div>
              </div>
            )}

            {/* Conditional Type 3 Fields */}
            {triggerType === 'Manual' && (
              <div className="p-4 bg-slate-50/40 dark:bg-slate-950/20 rounded-2xl border border-slate-205 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-2xs font-extrabold text-slate-555 dark:text-slate-400 uppercase block">Select Product *</label>
                  <select
                    required
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl px-3 py-2 text-xs text-slate-850 dark:text-white focus:outline-none h-10 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select product to produce...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-2xs font-extrabold text-slate-500 dark:text-slate-400 uppercase block">Reason / Occasion *</label>
                  <Input
                    placeholder="e.g. Festival Pre-stocking"
                    required
                    value={reasonOccasion}
                    onChange={(e) => setReasonOccasion(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-2xs font-extrabold text-slate-500 dark:text-slate-400 uppercase block">Authorized By (Manager) *</label>
                  <Input
                    placeholder="Manager Name"
                    required
                    value={authorizedBy}
                    onChange={(e) => setAuthorizedBy(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 rounded-xl"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t dark:border-slate-800 pt-4">
              <div className="space-y-1">
                <label className="text-2xs font-extrabold text-slate-500 uppercase block">Expected Yield Output (Pcs Per Batch) *</label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 rounded-xl"
                  required
                />
              </div>

              <DatePicker
                label="Start Date *"
                required
                value={startDate ? new Date(startDate) : null}
                onChange={(date) => setStartDate(date ? date.toISOString().split('T')[0] : '')}
                modalTitle="Select Start Date"
                placeholder="Select Date"
                className="space-y-1"
                labelClassName="text-2xs font-extrabold text-slate-500 uppercase block"
                triggerClassName="h-10 text-xs border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              />

              <div className="space-y-1">
                <label className="text-2xs font-extrabold text-slate-500 uppercase block">Expiry Buffer (Days)</label>
                <Input
                  type="number"
                  min="1"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value) || 365)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-2xs font-extrabold text-slate-500 uppercase block">Instructions / Remarks</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any special instructions or comments for the production team..."
                rows="2"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-850 dark:text-slate-250 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {shortfallError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-3 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-450">
                <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" />
                <div className="text-xs font-medium">
                  <p className="font-semibold">BOM SHORTFALL BLOCK</p>
                  <p>{shortfallError}</p>
                </div>
              </div>
            )}

            {/* Split Action Buttons: Schedule vs Schedule & Start */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Button
                type="button"
                onClick={(e) => handleSubmit(e, false)}
                disabled={submitting || !selectedProductId || quantity <= 0}
                className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-250 border border-slate-200 dark:border-slate-700 font-bold rounded-xl text-xs py-3 shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4 mr-1.5" /> Schedule Planned Batch
              </Button>

              <Button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={submitting || !selectedProductId || quantity <= 0 || !!shortfallError}
                className="bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold rounded-xl text-xs py-3 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 mr-1.5" /> Schedule & Start Batch
              </Button>
            </div>
          </form>
        </div>

        {/* Live Sidebar: BOM Check & SOP steps checklist */}
        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-205 dark:border-slate-800 space-y-4 shadow-sm">
            {/* Sidebar toggle buttons */}
            <div className="flex bg-slate-100 dark:bg-slate-950 border dark:border-slate-850 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSidebarTab('bom')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${sidebarTab === 'bom' ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
              >
                1. Material Stocks (BOM)
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('sop')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${sidebarTab === 'sop' ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
              >
                2. SOP Recipe Steps
              </button>
            </div>

            {/* TAB A: BOM CHECKLIST */}
            {sidebarTab === 'bom' && (
              <div className="space-y-3">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center text-xs uppercase tracking-wide">
                    <Layers className="w-4 h-4 mr-1.5 text-indigo-505 dark:text-indigo-400" /> Live Recipe BOM Check
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Inventory reserves check calculated per batch size.</p>
                </div>

                {bomLoading ? (
                  <div className="text-xs text-slate-400 py-12 text-center animate-pulse">Checking raw material stocks...</div>
                ) : bomDetails ? (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl flex justify-between items-center font-semibold text-indigo-700 dark:text-indigo-400">
                      <span>Batch Material Cost:</span>
                      <span>₹{Number(bomDetails.totalRmCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {bomDetails.items.map((item, idx) => {
                        const shortfall = item.requiredQty - item.availableStock;
                        return (
                          <div key={idx} className="p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl flex flex-col space-y-1 shadow-2xs">
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
                            <div className="flex justify-between text-[10px] text-slate-405">
                              <span>Req: {item.requiredQty.toFixed(2)}</span>
                              <span>Available: {item.availableStock.toFixed(2)}</span>
                            </div>
                            {shortfall > 0 && (
                              <p className="text-[10px] text-rose-500 font-semibold">Shortfall: -{shortfall.toFixed(2)} units</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 py-16 text-center italic">
                    Select a product and batch size to check raw material stocks.
                  </div>
                )}
              </div>
            )}

            {/* TAB B: RECIPE SOP CHECKLIST */}
            {sidebarTab === 'sop' && (
              <div className="space-y-3">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center text-xs uppercase tracking-wide">
                    <Flame className="w-4 h-4 mr-1.5 text-orange-500" /> Recipe SOP Workflow Steps
                  </h3>
                  <p className="text-[10px] text-slate-405 mt-0.5">Chronologically ordered processing instructions.</p>
                </div>

                {activeProduct ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {activeProduct.sopSteps && activeProduct.sopSteps.length > 0 ? (
                      activeProduct.sopSteps.map((step, idx) => (
                        <div key={idx} className="p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl space-y-1.5 text-xs shadow-2xs">
                          <p className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400">Step #{idx + 1}</p>
                          <p className="font-medium text-slate-700 dark:text-slate-200 leading-normal">{step.instruction}</p>
                          {(step.tempTime || step.safetyNote) && (
                            <div className="flex justify-between items-center text-[9px] text-slate-400 pt-1.5 border-t dark:border-slate-700 border-dashed">
                              {step.tempTime && <span>🕒 {step.tempTime}</span>}
                              {step.safetyNote && <span className="text-rose-500 font-bold">⚠️ {step.safetyNote}</span>}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic py-12 text-center">No SOP steps formulation logged for this finished product.</p>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 py-16 text-center italic">
                    Select a product specifications yield to view SOP steps guide.
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
