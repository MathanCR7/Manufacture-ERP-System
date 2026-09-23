import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '@/lib/axios';
import { 
  Factory, Calendar, Info, Layers, Users, TrendingUp, ChevronLeft, 
  ShoppingBag, ShieldAlert, Award, Flame, CheckCircle, Play, Save,
  AlertTriangle, Package, Check, Sparkles, HelpCircle, ArrowRight,
  RotateCcw, Sliders, Clock, Tag, FileText, ChevronDown, CheckCircle2,
  X, Scale, ListOrdered, CalendarDays, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import useAuthStore from '@/app/store/authStore';

import ProductSelectCombobox from '../components/ProductSelectCombobox';
import LiveBOMPanel from '../components/LiveBOMPanel';
import LiveSOPPanel from '../components/LiveSOPPanel';
import ScheduleConfirmationModal from '../components/ScheduleConfirmationModal';

// Preset Occasions for Seasonal / Manual mode
const OCCASION_PRESETS = [
  'Diwali Pre-stocking',
  'Christmas Special',
  'New Year Bash',
  'Summer Special',
  'Ramadan Pack',
  'Pongal / Sankranti Feast',
  'Valentine’s Day Special',
  'Monsoon Special',
  'Back-to-School Rush',
  'Wedding Season',
  'Trial / Test Batch',
  'Buffer Replenishment'
];

export default function AddProductionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useAuthStore(s => s.user);

  // Master Data Lists
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [allRawMaterials, setAllRawMaterials] = useState([]);
  const [stockStats, setStockStats] = useState({});
  const [usersList, setUsersList] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(true);

  // 4 Trigger Modes: 'Order-Based' | 'Replenishment' | 'Manual' | 'Regular'
  const [triggerType, setTriggerType] = useState('Order-Based');

  // Core Product & Batch Fields
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(100);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDays, setExpiryDays] = useState(365);
  const [note, setNote] = useState('');

  // Mode 1: Order-Based Fields
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [customerOrderQty, setCustomerOrderQty] = useState(0);
  const [minBufferStock, setMinBufferStock] = useState(0);
  const [currentStock, setCurrentStock] = useState(0);

  // Mode 2: Replenishment Fields
  const [targetStockLevel, setTargetStockLevel] = useState(200);

  // Mode 3: Seasonal / Manual Fields
  const [occasion, setOccasion] = useState('');
  const [isCustomOccasion, setIsCustomOccasion] = useState(false);
  const [customOccasionText, setCustomOccasionText] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('');

  // Mode 4: Regular Production Fields
  const [productionFrequency, setProductionFrequency] = useState('Daily'); // 'Daily' | 'Weekly' | 'One-off'
  const [standardBatchRef, setStandardBatchRef] = useState('');

  // Live BOM State
  const [bomItems, setBomItems] = useState([]);
  const [bomLoading, setBomLoading] = useState(false);
  const [removedBomItem, setRemovedBomItem] = useState(null);
  const [undoTimer, setUndoTimer] = useState(null);

  // Live SOP Steps State
  const [sopSteps, setSopSteps] = useState([]);
  const [saveAsNewSopVersion, setSaveAsNewSopVersion] = useState(false);

  // Sidebar Tab: 'bom' | 'sop'
  const [sidebarTab, setSidebarTab] = useState('bom');

  // Mobile Bottom Sheet / Drawer State
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Confirmation Modal & Submitting State
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Inline Validation Errors
  const [formErrors, setFormErrors] = useState({});

  // Active product reference
  const activeProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Selected Order Reference
  const selectedOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Initial Fetch of Masters
  useEffect(() => {
    let isMounted = true;
    const loadMasters = async () => {
      setLoadingMasters(true);
      try {
        const [prodRes, orderRes, rmRes, stockRes] = await Promise.all([
          api.get('/products'),
          api.get('/orders'),
          api.get('/item-setup/raw-material').catch(() => ({ data: [] })),
          api.get('/products/stock').catch(() => ({ data: [] }))
        ]);

        if (!isMounted) return;

        const prodList = prodRes.data || [];
        setProducts(prodList);

        // Open orders waiting for production or confirmed
        const openOrders = (orderRes.data || []).filter(o => 
          o.status === 'Confirmed' || o.status === 'Waiting for Production' || o.status === 'Quotation'
        );
        setOrders(openOrders);

        setAllRawMaterials(rmRes.data || []);

        // Build stock lookup map
        const stockMap = {};
        (stockRes.data || []).forEach(s => {
          stockMap[s.id] = Number(s.currentStock || 0);
        });
        setStockStats(stockMap);

        // Try loading user list for manager selection
        api.get('/users').then(r => {
          if (isMounted) setUsersList(r.data || []);
        }).catch(() => {
          if (isMounted && currentUser?.name) {
            setUsersList([{ id: currentUser.id, name: currentUser.name, role: currentUser.role }]);
          }
        });

        // Set default manager if empty
        if (currentUser?.name) {
          setAuthorizedBy(currentUser.name);
        }

        // Handle navigation prefill state
        const navState = location.state;
        if (navState) {
          if (navState.productId) {
            setSelectedProductId(navState.productId);
          }
          if (navState.quantity) {
            setQuantity(Number(navState.quantity));
          }
          if (navState.orderId) {
            setTriggerType('Order-Based');
            setSelectedOrderId(navState.orderId);
          } else if (navState.triggerType) {
            setTriggerType(navState.triggerType);
          }
        }
      } catch (err) {
        console.error('Error fetching master records:', err);
      } finally {
        if (isMounted) setLoadingMasters(false);
      }
    };

    loadMasters();
    return () => { isMounted = false; };
  }, [location.state]);

  // Load product stock info and initialize SOP steps when product changes
  useEffect(() => {
    if (!selectedProductId || !activeProduct) {
      setCurrentStock(0);
      setMinBufferStock(0);
      setSopSteps([]);
      return;
    }

    const liveCurr = stockStats[selectedProductId] !== undefined 
      ? stockStats[selectedProductId] 
      : Number(activeProduct.currentStock || 0);

    const minLevelVal = activeProduct.stockLevels?.[0]?.minLevel 
      ? Number(activeProduct.stockLevels[0].minLevel) 
      : Number(activeProduct.alertLevel || 0);

    setCurrentStock(liveCurr);
    setMinBufferStock(minLevelVal);

    // Initialize SOP steps from product recipe
    if (activeProduct.sopSteps && Array.isArray(activeProduct.sopSteps)) {
      setSopSteps([...activeProduct.sopSteps]);
    } else {
      setSopSteps([]);
    }
  }, [selectedProductId, activeProduct, stockStats]);

  // Mode 1: Order-Based sync and Suggested Yield formula
  useEffect(() => {
    if (triggerType !== 'Order-Based') return;

    if (!selectedOrderId) {
      setCustomerOrderQty(0);
      return;
    }

    const orderObj = orders.find(o => o.id === selectedOrderId);
    if (!orderObj) return;

    // If order has items and no product is chosen, or product is not in this order, auto-pick first item
    const items = orderObj.items || [];
    let matchedItem = items.find(it => it.productId === selectedProductId);

    if (!matchedItem && items.length > 0) {
      matchedItem = items[0];
      setSelectedProductId(matchedItem.productId);
    }

    const oQty = matchedItem ? Number(matchedItem.quantity) : 0;
    setCustomerOrderQty(oQty);

    // Formula: Suggested Yield = (Order Qty - Current Stock) + Min Buffer
    const calculatedSuggested = Math.max(0, (oQty - currentStock) + minBufferStock);
    if (calculatedSuggested > 0) {
      setQuantity(calculatedSuggested);
    } else if (!quantity || quantity <= 0) {
      setQuantity(oQty > 0 ? oQty : 1);
    }
  }, [selectedOrderId, selectedProductId, currentStock, minBufferStock, triggerType, orders]);

  // Mode 2: Replenishment target stock calculation
  useEffect(() => {
    if (triggerType !== 'Replenishment') return;
    if (minBufferStock > 0 && targetStockLevel <= minBufferStock) {
      setTargetStockLevel(minBufferStock + 50);
    }
    const needed = Math.max(1, targetStockLevel - currentStock);
    setQuantity(needed);
  }, [targetStockLevel, currentStock, minBufferStock, triggerType]);

  // Fetch BOM expansion from backend when product or yield quantity changes
  useEffect(() => {
    if (!selectedProductId || quantity <= 0) {
      setBomItems([]);
      return;
    }

    let isSubscribed = true;
    const expandBom = async () => {
      setBomLoading(true);
      try {
        const res = await api.post(`/products/${selectedProductId}/bom/expand?qty=${quantity}`);
        if (!isSubscribed) return;

        const expanded = (res.data.items || []).map(item => ({
          ...item,
          rmId: item.rawMaterialId,
          unit: item.unit || 'kg',
          status: Number(item.availableStock || 0) >= Number(item.requiredQty || 0) ? 'Sufficient' : 'Insufficient'
        }));

        setBomItems(expanded);
      } catch (err) {
        console.error('Failed to expand BOM:', err);
      } finally {
        if (isSubscribed) setBomLoading(false);
      }
    };

    const timer = setTimeout(expandBom, 250);
    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [selectedProductId, quantity]);

  // Derived suggested yield for Order-Based
  const suggestedYieldNumber = useMemo(() => {
    if (triggerType !== 'Order-Based') return 0;
    return Math.max(0, (customerOrderQty - currentStock) + minBufferStock);
  }, [triggerType, customerOrderQty, currentStock, minBufferStock]);

  // Shortfall items detection
  const insufficientItems = useMemo(() => {
    return bomItems.filter(item => Number(item.availableStock || 0) < Number(item.requiredQty || 0));
  }, [bomItems]);

  const hasShortfall = insufficientItems.length > 0;

  // Total Batch Cost computed live
  const totalBatchCost = useMemo(() => {
    return bomItems.reduce((sum, item) => sum + (Number(item.requiredQty || 0) * Number(item.unitCost || 0)), 0);
  }, [bomItems]);

  // Handle Undo of removed raw material
  const handleUndoRemove = (item, index) => {
    setRemovedBomItem(item);
    if (undoTimer) clearTimeout(undoTimer);
    const t = setTimeout(() => {
      setRemovedBomItem(null);
    }, 6000);
    setUndoTimer(t);
  };

  const executeUndo = () => {
    if (!removedBomItem) return;
    setBomItems(prev => [...prev, removedBomItem]);
    setRemovedBomItem(null);
    if (undoTimer) clearTimeout(undoTimer);
  };

  // Form Validation
  const validateForm = () => {
    const errors = {};
    if (!selectedProductId) errors.productId = 'Product selection is required';
    if (!quantity || quantity <= 0) errors.quantity = 'Yield quantity must be at least 1';
    if (!startDate) errors.startDate = 'Start date is required';

    if (triggerType === 'Order-Based') {
      if (!selectedOrderId) errors.orderId = 'Customer order link is required';
    } else if (triggerType === 'Replenishment') {
      if (targetStockLevel <= minBufferStock) {
        errors.targetStock = `Target stock must exceed safety threshold (${minBufferStock})`;
      }
    } else if (triggerType === 'Manual') {
      const finalOccasion = isCustomOccasion ? customOccasionText.trim() : occasion.trim();
      if (!finalOccasion) errors.occasion = 'Reason / occasion is required';
      if (!authorizedBy.trim()) errors.authorizedBy = 'Authorizing manager is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submission handler
  const handleExecuteBatch = async (isImmediateStart) => {
    if (!validateForm()) {
      Swal.fire({
        icon: 'error',
        title: 'Missing Required Fields',
        text: 'Please complete all required fields highlighted in red before proceeding.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    if (isImmediateStart && hasShortfall) {
      Swal.fire({
        icon: 'error',
        title: 'Immediate Start Blocked',
        html: `
          <p class="text-xs text-slate-600 dark:text-slate-300">
            One or more ingredients in the recipe BOM are insufficient in warehouse inventory.
            Replenish materials or save as a <strong>Planned Batch</strong>.
          </p>
        `,
        confirmButtonColor: '#ef4444'
      });
      return;
    }

    setSubmitting(true);
    try {
      const finalOccasion = isCustomOccasion ? customOccasionText : occasion;
      const typeLabel = triggerType === 'Order-Based' ? 'Make to Order' : 'Make to Stock';

      // Build composite note
      const noteParts = [
        `Trigger Mode: ${triggerType}`,
        note ? `Remarks: ${note}` : '',
        triggerType === 'Manual' ? `Reason/Occasion: ${finalOccasion} | Authorized by: ${authorizedBy}` : '',
        triggerType === 'Regular' ? `Frequency: ${productionFrequency} ${standardBatchRef ? `| Template: ${standardBatchRef}` : ''}` : ''
      ].filter(Boolean);

      // Custom BOM payload
      const customBomPayload = bomItems.map(item => ({
        rmId: item.rawMaterialId || item.rmId,
        requiredQty: Number(item.requiredQty),
        unitCost: Number(item.unitCost || 0)
      }));

      const payload = {
        productId: selectedProductId,
        productionType: typeLabel,
        status: isImmediateStart ? 'In Progress' : 'Planned',
        startDate,
        expiryDays: Number(expiryDays) || 365,
        quantity: Number(quantity),
        note: noteParts.join(' • '),
        orderId: triggerType === 'Order-Based' ? selectedOrderId : undefined,
        customBom: customBomPayload
      };

      const response = await api.post('/production', payload);
      const createdBatch = response.data;

      // If user opted to save new SOP version
      if (saveAsNewSopVersion && sopSteps.length > 0 && selectedProductId) {
        try {
          await api.put(`/products/${selectedProductId}`, {
            ...activeProduct,
            sopSteps
          });
        } catch (e) {
          console.warn('Could not auto-update product master SOP version:', e);
        }
      }

      setConfirmationModalOpen(false);

      const isDark = document.documentElement.classList.contains('dark');
      await Swal.fire({
        title: `<span class="text-sm font-bold text-slate-800 dark:text-slate-100">${isImmediateStart ? 'Batch Started & Stock Reserved!' : 'Batch Planned Successfully!'}</span>`,
        html: `
          <div class="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 mt-1 text-left">
            <p><strong>Batch Ref:</strong> ${createdBatch.referenceNo || 'Created'}</p>
            <p><strong>Product:</strong> ${activeProduct?.name}</p>
            <p><strong>Target Yield:</strong> ${quantity} ${activeProduct?.unit?.abbreviation || 'pcs'}</p>
            <p><strong>Status:</strong> <span class="font-bold ${isImmediateStart ? 'text-amber-600' : 'text-blue-600'}">${isImmediateStart ? 'In Progress (Raw Materials Locked)' : 'Planned (No Inventory Lock)'}</span></p>
            ${triggerType === 'Order-Based' && selectedOrder ? `<p class="text-indigo-600 dark:text-indigo-400 font-semibold">✓ Order #${selectedOrder.referenceNo} updated to "In Production"</p>` : ''}
          </div>
        `,
        icon: 'success',
        confirmButtonColor: '#4f46e5',
        confirmButtonText: 'Go to Batch Monitor',
        background: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)',
        color: isDark ? '#f8fafc' : '#0f172a'
      });

      navigate('/production/batches');
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: 'Scheduling Failed',
        text: err.response?.data?.error || err.message || 'Unable to schedule production batch.',
        icon: 'error',
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-6 lg:px-8 py-4 space-y-4 mx-auto transition-all duration-300">
      
      {/* ─────────────────────── 2. PAGE HEADER ─────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md pb-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="p-2 border border-slate-200 dark:border-slate-750 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            title="Return to previous screen"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </Button>

          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 truncate">
              <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Factory className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <span className="truncate">Schedule New Production</span>
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block truncate mt-0.5">
              Monitor raw material stocks in real-time, view saved recipe SOP steps, and trigger immediate batch execution.
            </p>
          </div>
        </div>

        {/* Live Shortfall Pill on Mobile & Tablet */}
        <div className="lg:hidden flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMobileDrawerOpen(true)}
            className={`rounded-xl text-xs font-bold h-9 px-3 flex items-center gap-1.5 cursor-pointer shadow-xs ${
              hasShortfall
                ? 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900 animate-pulse'
                : 'border-indigo-200 bg-indigo-50/60 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
            }`}
          >
            {hasShortfall ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>{insufficientItems.length} Shortfall</span>
              </>
            ) : (
              <>
                <Layers className="w-3.5 h-3.5" />
                <span>Check BOM ({bomItems.length})</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ─────────────────────── 3. PRODUCTION TRIGGER SELECTOR (4 MODES) ─────────────────────── */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block px-1">
          Production Trigger Mode
        </label>
        <div className="overflow-x-auto pb-1 scrollbar-none">
          <div className="grid grid-cols-4 min-w-[540px] sm:min-w-full p-1 bg-slate-100/90 dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 gap-1.5 shadow-2xs">
            {[
              { id: 'Order-Based', label: '1. Order-Based', sub: 'Make-to-Order' },
              { id: 'Replenishment', label: '2. Replenishment', sub: 'Make-to-Stock' },
              { id: 'Manual', label: '3. Seasonal / Manual', sub: 'Ad-hoc Runs' },
              { id: 'Regular', label: '4. Regular Production', sub: 'Routine Batches' }
            ].map(tab => {
              const isActive = triggerType === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setTriggerType(tab.id);
                    setFormErrors({});
                  }}
                  className={`py-2 px-2.5 rounded-xl text-center transition-all duration-200 cursor-pointer select-none ${
                    isActive
                      ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 font-bold shadow-sm border border-slate-200/60 dark:border-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-slate-800/40 font-medium'
                  }`}
                >
                  <span className="block text-xs truncate font-bold">{tab.label}</span>
                  <span className={`block text-[9px] truncate mt-0.5 ${isActive ? 'text-indigo-600/80 dark:text-indigo-400/80 font-medium' : 'text-slate-400'}`}>
                    {tab.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─────────────────────── 4. MAIN TWO-COLUMN DASHBOARD GRID ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COLUMN: FORM FIELDS (60% on desktop) */}
        <div className="lg:col-span-7 space-y-4">

          {/* Form Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-sm space-y-5">
            
            {/* 4. PRODUCT SELECTION ENHANCEMENT: PRODUCT SUMMARY CHIP */}
            {activeProduct && (
              <div className="p-3 bg-gradient-to-r from-indigo-50/70 via-slate-50/50 to-white dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900 rounded-2xl border border-indigo-100/80 dark:border-indigo-900/60 flex items-center justify-between gap-3 animate__animated animate__fadeIn">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center overflow-hidden shrink-0">
                    {activeProduct.imageUrl ? (
                      <img src={activeProduct.imageUrl} alt={activeProduct.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">
                        {activeProduct.name?.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {activeProduct.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                        {activeProduct.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      <span>{activeProduct.category?.name || 'Category'}</span>
                      <span>•</span>
                      <span>UOM: {activeProduct.unit?.abbreviation || 'pcs'}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Current Balance: {currentStock} {activeProduct.unit?.abbreviation || 'pcs'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedProductId('')}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Switch Product"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* 3.1 MODE 1: ORDER-BASED FIELDS */}
            {triggerType === 'Order-Based' && (
              <div className="p-4 bg-indigo-50/30 dark:bg-indigo-950/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-extrabold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Customer Order Linkage
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {orders.length} open customer orders
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Customer Order Select */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                      Linked Customer Order *
                    </label>
                    <select
                      value={selectedOrderId}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                      className={`w-full bg-white dark:bg-slate-900 border rounded-xl px-3 py-2 text-xs text-slate-850 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-indigo-500 h-10 cursor-pointer ${
                        formErrors.orderId ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <option value="">Choose confirmed customer order...</option>
                      {orders.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.referenceNo} — {o.customer?.name} ({o.items?.length || 0} items)
                        </option>
                      ))}
                    </select>
                    {formErrors.orderId && (
                      <p className="text-[10px] text-rose-500">{formErrors.orderId}</p>
                    )}
                  </div>

                  {/* Filtered Product Select */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                      Select Item in Order *
                    </label>
                    <ProductSelectCombobox
                      products={
                        selectedOrderId
                          ? (selectedOrder?.items || []).map(it => it.product).filter(Boolean)
                          : products
                      }
                      value={selectedProductId}
                      onChange={(id) => setSelectedProductId(id)}
                      placeholder={selectedOrderId ? "Select item from this order..." : "Choose order first..."}
                      error={formErrors.productId}
                    />
                  </div>
                </div>

                {/* Metric Cards Row */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Order Qty</p>
                    <p className="font-extrabold text-slate-800 dark:text-white mt-0.5">
                      {customerOrderQty} {activeProduct?.unit?.abbreviation || 'pcs'}
                    </p>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Current Stock</p>
                    <p className="font-extrabold text-slate-800 dark:text-white mt-0.5">
                      {currentStock} {activeProduct?.unit?.abbreviation || 'pcs'}
                    </p>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Min Buffer Stock</p>
                    <p className="font-extrabold text-slate-800 dark:text-white mt-0.5">
                      {minBufferStock} {activeProduct?.unit?.abbreviation || 'pcs'}
                    </p>
                  </div>
                </div>

                {/* Suggested Yield Banner with Formula Tooltip */}
                <div className="p-3 bg-indigo-600/10 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/60 dark:border-indigo-900/60 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-indigo-800 dark:text-indigo-300">
                        System Suggested Yield
                      </span>
                      <div className="group relative cursor-help">
                        <Info className="w-3.5 h-3.5 text-indigo-500" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-52 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg z-50">
                          Formula: (Order Qty − Current Stock) + Min Buffer
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Formula: ({customerOrderQty} − {currentStock}) + {minBufferStock}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-black text-sm text-indigo-700 dark:text-indigo-300">
                      {suggestedYieldNumber > 0 ? `${suggestedYieldNumber} ${activeProduct?.unit?.abbreviation || 'pcs'}` : 'Sufficient Stock (0 pcs)'}
                    </span>
                    {suggestedYieldNumber > 0 && (
                      <button
                        type="button"
                        onClick={() => setQuantity(suggestedYieldNumber)}
                        className="block text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer ml-auto"
                      >
                        Apply Suggested
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3.2 MODE 2: REPLENISHMENT FIELDS */}
            {triggerType === 'Replenishment' && (
              <div className="p-4 bg-amber-50/20 dark:bg-amber-950/10 rounded-2xl border border-amber-100 dark:border-amber-900/40 space-y-4">
                <span className="text-2xs font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Make-to-Stock Replenishment
                </span>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                    Select Product *
                  </label>
                  <ProductSelectCombobox
                    products={products}
                    value={selectedProductId}
                    onChange={(id) => setSelectedProductId(id)}
                    placeholder="Search product code or name to replenish..."
                    error={formErrors.productId}
                  />
                </div>

                {/* Replenishment Metric Cards */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Current Stock</p>
                    <p className="font-extrabold text-slate-800 dark:text-white mt-0.5">
                      {currentStock} {activeProduct?.unit?.abbreviation || 'pcs'}
                    </p>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Minimum Hold</p>
                    <p className="font-extrabold text-slate-800 dark:text-white mt-0.5">
                      {minBufferStock} {activeProduct?.unit?.abbreviation || 'pcs'}
                    </p>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Shortfall</p>
                    <p className={`font-extrabold mt-0.5 ${currentStock < minBufferStock ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
                      {currentStock < minBufferStock ? `−${minBufferStock - currentStock}` : '0 (Healthy)'}
                    </p>
                  </div>
                </div>

                {/* Target Stock After Production Input */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                      Target Stock Level After Production *
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Must exceed minimum hold ({minBufferStock})
                    </span>
                  </div>
                  <Input
                    type="number"
                    min={minBufferStock + 1}
                    value={targetStockLevel}
                    onChange={(e) => setTargetStockLevel(Number(e.target.value) || 0)}
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-10 rounded-xl"
                  />
                  {formErrors.targetStock && (
                    <p className="text-[10px] text-rose-500">{formErrors.targetStock}</p>
                  )}
                  <p className="text-[10px] text-slate-400">
                    Auto-computes required batch size: Target ({targetStockLevel}) − Current ({currentStock}) = <strong>{Math.max(1, targetStockLevel - currentStock)} {activeProduct?.unit?.abbreviation || 'pcs'}</strong>
                  </p>
                </div>
              </div>
            )}

            {/* 3.3 MODE 3: SEASONAL / MANUAL FIELDS */}
            {triggerType === 'Manual' && (
              <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                <span className="text-2xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Ad-Hoc / Festival Production Run
                </span>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                    Select Product *
                  </label>
                  <ProductSelectCombobox
                    products={products}
                    value={selectedProductId}
                    onChange={(id) => setSelectedProductId(id)}
                    placeholder="Search product code or name to schedule..."
                    error={formErrors.productId}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Occasion / Season Combo Box */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                      Occasion / Season *
                    </label>
                    {!isCustomOccasion ? (
                      <div className="space-y-1">
                        <select
                          value={occasion}
                          onChange={(e) => {
                            if (e.target.value === '__CUSTOM__') {
                              setIsCustomOccasion(true);
                              setOccasion('');
                            } else {
                              setOccasion(e.target.value);
                            }
                          }}
                          className={`w-full bg-white dark:bg-slate-900 border rounded-xl px-3 py-2 text-xs text-slate-850 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-indigo-500 h-10 cursor-pointer ${
                            formErrors.occasion ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <option value="">Select festive occasion or reason...</option>
                          {OCCASION_PRESETS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                          <option value="__CUSTOM__" className="font-bold text-indigo-600">
                            + Add Custom Reason...
                          </option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Input
                          autoFocus
                          placeholder="Type custom occasion or reason..."
                          value={customOccasionText}
                          onChange={(e) => setCustomOccasionText(e.target.value)}
                          className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-10 rounded-xl"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setIsCustomOccasion(false);
                            setCustomOccasionText('');
                          }}
                          className="h-10 text-xs px-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        >
                          Presets
                        </Button>
                      </div>
                    )}
                    {formErrors.occasion && (
                      <p className="text-[10px] text-rose-500">{formErrors.occasion}</p>
                    )}
                  </div>

                  {/* Authorized By Manager */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                      Authorized By (Manager) *
                    </label>
                    <div className="relative">
                      <Input
                        placeholder="Manager Name"
                        value={authorizedBy}
                        onChange={(e) => setAuthorizedBy(e.target.value)}
                        list="managers-list"
                        className={`bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-10 rounded-xl ${
                          formErrors.authorizedBy ? 'border-rose-400 ring-1 ring-rose-400' : ''
                        }`}
                      />
                      <datalist id="managers-list">
                        {usersList.map(u => (
                          <option key={u.id} value={u.name}>{u.role}</option>
                        ))}
                      </datalist>
                    </div>
                    {formErrors.authorizedBy && (
                      <p className="text-[10px] text-rose-500">{formErrors.authorizedBy}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3.4 MODE 4: REGULAR PRODUCTION FIELDS */}
            {triggerType === 'Regular' && (
              <div className="p-4 bg-violet-50/20 dark:bg-violet-950/10 rounded-2xl border border-violet-100 dark:border-violet-900/40 space-y-4">
                <span className="text-2xs font-extrabold text-violet-700 dark:text-violet-400 uppercase tracking-wide flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Routine Batch Run Template
                </span>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                    Select Product *
                  </label>
                  <ProductSelectCombobox
                    products={products}
                    value={selectedProductId}
                    onChange={(id) => setSelectedProductId(id)}
                    placeholder="Search product code or name to produce..."
                    error={formErrors.productId}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Production Frequency Chip Select */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                      Production Frequency
                    </label>
                    <div className="flex gap-2">
                      {['Daily', 'Weekly', 'One-off'].map(freq => (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => setProductionFrequency(freq)}
                          className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            productionFrequency === freq
                              ? 'bg-violet-600 text-white border-violet-600 shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {freq}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Standard Batch Reference */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                      Routine Reference (Optional)
                    </label>
                    <Input
                      placeholder="e.g. STD-PLAN-WEEKLY-01"
                      value={standardBatchRef}
                      onChange={(e) => setStandardBatchRef(e.target.value)}
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3.5 COMMON FIELDS: YIELD, START DATE, EXPIRY BUFFER */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Expected Yield Output */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                  Expected Yield Output ({activeProduct?.unit?.abbreviation || 'pcs'}) *
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className={`bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-10 rounded-xl font-mono font-bold text-xs ${
                      formErrors.quantity ? 'border-rose-400 ring-1 ring-rose-400' : ''
                    }`}
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-semibold pointer-events-none">
                    {activeProduct?.unit?.abbreviation || 'units'}
                  </span>
                </div>
                {formErrors.quantity && (
                  <p className="text-[10px] text-rose-500">{formErrors.quantity}</p>
                )}
              </div>

              {/* Start Date */}
              <div className="space-y-1">
                <DatePicker
                  label="Start Date *"
                  required
                  value={startDate ? new Date(startDate) : null}
                  onChange={(date) => setStartDate(date ? date.toISOString().split('T')[0] : '')}
                  modalTitle="Select Production Start Date"
                  placeholder="Select Date"
                  className="space-y-1"
                  labelClassName="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block"
                  triggerClassName="h-10 text-xs border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl bg-white dark:bg-slate-900 focus:ring-indigo-500"
                />
              </div>

              {/* Expiry Buffer Days */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                  Expiry Buffer (Days)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Number(e.target.value) || 365)}
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-10 rounded-xl font-mono text-xs"
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-semibold pointer-events-none">
                    days
                  </span>
                </div>
              </div>
            </div>

            {/* Remarks / Instructions */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase block">
                Instructions / Remarks for Floor Staff
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Special processing guidelines, batch sequencing notes, or customer requirements..."
                rows="2"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500 leading-relaxed resize-none"
              />
            </div>

            {/* ─────────────────────── 6. ACTION BUTTONS (DESKTOP) ─────────────────────── */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 hidden sm:grid grid-cols-2 gap-3">
              {/* Secondary Button: Schedule Planned Batch */}
              <Button
                type="button"
                variant="outline"
                disabled={submitting || !selectedProductId || quantity <= 0}
                onClick={() => handleExecuteBatch(false)}
                className="rounded-xl h-11 text-xs font-bold border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <Save className="w-4 h-4 text-slate-500" />
                Schedule Planned Batch
              </Button>

              {/* Primary Filled Button: Schedule & Start Batch */}
              <div className="relative group">
                <Button
                  type="button"
                  disabled={submitting || !selectedProductId || quantity <= 0 || hasShortfall}
                  onClick={() => setConfirmationModalOpen(true)}
                  className={`w-full rounded-xl h-11 text-xs font-bold text-white flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                    hasShortfall
                      ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25 hover:shadow-lg'
                  }`}
                >
                  <Play className="w-4 h-4 fill-white" />
                  Schedule & Start Batch
                </Button>

                {hasShortfall && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-slate-900 text-white text-[10px] rounded-xl shadow-xl z-50 text-center">
                    ⚠️ Cannot start batch immediately: One or more raw materials are insufficient in stock.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ─────────────────────── RIGHT COLUMN: LIVE INTELLIGENCE SIDEBAR (40% desktop) ─────────────────────── */}
        <div className="lg:col-span-5 hidden lg:block sticky top-20">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            
            {/* Sidebar Tab Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSidebarTab('bom')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'bom'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                1. Material Stocks (BOM)
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('sop')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'sop'
                    ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                2. SOP Recipe Steps
              </button>
            </div>

            {/* TAB 1: LIVE BOM */}
            {sidebarTab === 'bom' && (
              <LiveBOMPanel
                bomItems={bomItems}
                setBomItems={setBomItems}
                loading={bomLoading}
                product={activeProduct}
                batchQty={quantity}
                allRawMaterials={allRawMaterials}
                onUndoRemove={handleUndoRemove}
                removedItem={removedBomItem}
                onClearUndo={() => setRemovedBomItem(null)}
              />
            )}

            {/* TAB 2: RECIPE SOP */}
            {sidebarTab === 'sop' && (
              <LiveSOPPanel
                sopSteps={sopSteps}
                setSopSteps={setSopSteps}
                product={activeProduct}
                saveAsNewVersion={saveAsNewSopVersion}
                setSaveAsNewVersion={setSaveAsNewSopVersion}
              />
            )}

          </div>
        </div>

      </div>

      {/* ─────────────────────── MOBILE & TABLET DRAWER / BOTTOM SHEET ─────────────────────── */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs animate__animated animate__fadeIn">
          <div 
            className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col animate__animated animate__slideInUp"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {/* Tab Switcher in Drawer */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-950 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setSidebarTab('bom')}
                  className={`py-1 px-3 text-xs font-bold rounded-lg transition-all ${
                    sidebarTab === 'bom'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Recipe BOM ({bomItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('sop')}
                  className={`py-1 px-3 text-xs font-bold rounded-lg transition-all ${
                    sidebarTab === 'sop'
                      ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  SOP Steps ({sopSteps.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-4 overflow-y-auto flex-1">
              {sidebarTab === 'bom' ? (
                <LiveBOMPanel
                  bomItems={bomItems}
                  setBomItems={setBomItems}
                  loading={bomLoading}
                  product={activeProduct}
                  batchQty={quantity}
                  allRawMaterials={allRawMaterials}
                  onUndoRemove={handleUndoRemove}
                  removedItem={removedBomItem}
                  onClearUndo={() => setRemovedBomItem(null)}
                />
              ) : (
                <LiveSOPPanel
                  sopSteps={sopSteps}
                  setSopSteps={setSopSteps}
                  product={activeProduct}
                  saveAsNewVersion={saveAsNewSopVersion}
                  setSaveAsNewVersion={setSaveAsNewSopVersion}
                />
              )}
            </div>

            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
              <Button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="w-full bg-slate-800 text-white rounded-xl h-10 text-xs font-bold"
              >
                Done Inspecting
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────── STICKY MOBILE BOTTOM ACTION BAR ─────────────────────── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 shadow-2xl">
        <Button
          type="button"
          variant="outline"
          disabled={submitting || !selectedProductId || quantity <= 0}
          onClick={() => handleExecuteBatch(false)}
          className="rounded-xl h-11 text-xs font-bold border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5"
        >
          <Save className="w-4 h-4 text-slate-500" />
          Plan Batch
        </Button>

        <Button
          type="button"
          disabled={submitting || !selectedProductId || quantity <= 0 || hasShortfall}
          onClick={() => setConfirmationModalOpen(true)}
          className={`rounded-xl h-11 text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-sm ${
            hasShortfall
              ? 'bg-slate-400 dark:bg-slate-700 opacity-60'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          <Play className="w-4 h-4 fill-white" />
          Start Batch
        </Button>
      </div>

      {/* ─────────────────────── CONFIRMATION PRE-EXECUTION MODAL ─────────────────────── */}
      <ScheduleConfirmationModal
        isOpen={confirmationModalOpen}
        onClose={() => setConfirmationModalOpen(false)}
        onConfirm={() => handleExecuteBatch(true)}
        submitting={submitting}
        product={activeProduct}
        quantity={quantity}
        triggerType={triggerType}
        startDate={startDate}
        bomItems={bomItems}
        totalCost={totalBatchCost}
        order={selectedOrder}
        occasion={isCustomOccasion ? customOccasionText : occasion}
        authorizedBy={authorizedBy}
      />

    </div>
  );
}
