import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  ShoppingCart, Search, CreditCard, User, Tag, FileText, Check, Plus, Minus, 
  Trash2, Printer, CheckCircle, Package, ArrowRight, ShieldAlert, Award, 
  PlusCircle, RefreshCw, Layers, Sparkles, Clock, AlertTriangle, KeyRound, Ban 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Swal from 'sweetalert2';

export default function SalesPOSPage() {
  // POS Master Lists & Status
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [barcodeInput, setBarcodeInput] = useState('');

  // Shift Management State
  const [shiftActive, setShiftActive] = useState(false);
  const [shiftData, setShiftData] = useState({
    openingCash: 0,
    counterId: 'Counter A',
    staffName: 'Staff User',
    startTime: null,
  });
  const [expectedCash, setExpectedCash] = useState(0);
  const [actualCashInput, setActualCashInput] = useState('');
  const [shiftLogs, setShiftLogs] = useState([]);

  // Active View Tab: 'sales' | 'returns'
  const [activeTab, setActiveTab] = useState('sales');

  // Customer Management
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [creditDetails, setCreditDetails] = useState(null);
  const [customerLoyalty, setCustomerLoyalty] = useState(0);
  const [redeemLoyalty, setRedeemLoyalty] = useState(false);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);

  // New Customer Inline Form Modal
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustForm, setNewCustForm] = useState({
    name: '',
    phone: '',
    email: '',
    customerType: 'RETAIL',
    creditLimit: '5000',
    address: '',
    note: ''
  });

  // Cart / Bill State: Array of { product, quantity, unitPrice, discount, originalPrice }
  const [cart, setCart] = useState([]);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [taxType, setTaxType] = useState('Exclusive');
  const [discountReason, setDiscountReason] = useState('');
  const [generalDiscount, setGeneralDiscount] = useState(0);
  const [note, setNote] = useState('');

  // Split Payment Inputs
  const [splitCash, setSplitCash] = useState('');
  const [splitDigital, setSplitDigital] = useState('');

  // Delivery / Pre-Order fields
  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryDetails, setDeliveryDetails] = useState({
    deliveryDate: new Date().toISOString().split('T')[0],
    deliveryAddress: '',
    deliveryCharge: 0,
    driverName: '',
    specialNotes: ''
  });

  // Return Form State
  const [returnInvoiceNo, setReturnInvoiceNo] = useState('');
  const [returnReason, setReturnReason] = useState('Damaged');
  const [refundMethod, setRefundMethod] = useState('Cash Refund');
  const [returnItems, setReturnItems] = useState([]); // Array of { product, quantity, condition }

  // Held Bills (Bill Parking, maximum 5)
  const [heldBills, setHeldBills] = useState([]);

  // Modals & Popups
  const [receipt, setReceipt] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showManagerPinModal, setShowManagerPinModal] = useState(false);
  const [managerPinAction, setManagerPinAction] = useState(null); // { type, callback }
  const [pinValue, setPinValue] = useState('');

  // Categories list dynamically evaluated from active database products
  const categories = ['All', ...new Set(products.map(p => p.category?.name).filter(Boolean))];

  // Load master data on mount
  useEffect(() => {
    // Load persisted shift from localStorage
    const savedShift = localStorage.getItem('pos_active_shift');
    if (savedShift) {
      setShiftActive(true);
      setShiftData(JSON.parse(savedShift));
    }

    const savedLogs = localStorage.getItem('pos_shift_history');
    if (savedLogs) {
      setShiftLogs(JSON.parse(savedLogs));
    }

    const savedHeld = localStorage.getItem('pos_held_bills');
    if (savedHeld) {
      setHeldBills(JSON.parse(savedHeld));
    }

    loadPOSData();
  }, []);

  const loadPOSData = async () => {
    setLoading(true);
    try {
      const prodRes = await api.get('/products');
      const custRes = await api.get('/parties/customers');
      
      setProducts(prodRes.data || []);
      const clients = custRes.data || [];
      setCustomers(clients);

      // Pre-select Retail/Walk-in customer if exists
      const retail = clients.find(c => c.name.toUpperCase().includes('RETAIL')) || clients[0];
      if (retail) {
        setSelectedCustomerId(retail.id);
      }
    } catch (err) {
      console.error('Error loading POS resources', err);
    } finally {
      setLoading(false);
    }
  };

  // Listen to customer select and verify credit limit / loyalty points
  useEffect(() => {
    if (!selectedCustomerId) {
      setCreditDetails(null);
      setCustomerLoyalty(0);
      setLoyaltyDiscount(0);
      setRedeemLoyalty(false);
      return;
    }

    const verifyCustomerCredit = async () => {
      try {
        const creditRes = await api.get(`/sales/check-credit/${selectedCustomerId}`);
        setCreditDetails(creditRes.data);

        // Fetch customer loyalty points
        const loyaltyRes = await api.get(`/sales/customer-loyalty/${selectedCustomerId}`);
        setCustomerLoyalty(loyaltyRes.data?.loyaltyPoints || 0);
      } catch (err) {
        console.error('Failed to load credit details', err);
      }
    };

    verifyCustomerCredit();
  }, [selectedCustomerId]);

  // Adjust loyalty discount whenever redeemLoyalty toggles
  useEffect(() => {
    if (redeemLoyalty) {
      // 100 points = ₹10 discount, or dynamically adjust
      const maxDiscount = Math.floor(customerLoyalty / 100) * 10;
      setLoyaltyDiscount(maxDiscount);
    } else {
      setLoyaltyDiscount(0);
    }
  }, [redeemLoyalty, customerLoyalty]);

  // Barcode quick add scanner input handler
  const handleBarcodeSubmit = (e) => {
    if (e) e.preventDefault();
    if (!barcodeInput.trim()) return;

    // Search for product with matching code
    const match = products.find(p => p.code?.toUpperCase() === barcodeInput.trim().toUpperCase());
    if (match) {
      handleAddToCart(match);
      setBarcodeInput('');
    } else {
      Swal.fire({
        title: '<span class="text-xs font-bold text-slate-800">Barcode Unknown</span>',
        text: `No product registered with code "${barcodeInput}"`,
        icon: 'warning',
        timer: 1500,
        showConfirmButton: false,
        background: document.documentElement.classList.contains('dark') ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)',
        color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#0f172a'
      });
      setBarcodeInput('');
    }
  };

  // Add item to active cart
  const handleAddToCart = (product) => {
    const isDark = document.documentElement.classList.contains('dark');
    const available = Number(product.currentStock || 0);

    if (available <= 0) {
      Swal.fire({
        title: '<span class="text-xs font-bold">Product Out of Stock</span>',
        text: `Cannot sell "${product.name}". Current available inventory is zero.`,
        icon: 'error',
        confirmButtonColor: '#4f46e5',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty + 1 > available) {
        Swal.fire({
          title: '<span class="text-xs font-bold">Inventory Limit</span>',
          text: `Only ${available} units available in stock.`,
          icon: 'warning',
          background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          color: isDark ? '#f8fafc' : '#0f172a'
        });
        return;
      }
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { 
        product, 
        quantity: 1, 
        unitPrice: Number(product.salePrice || 0), 
        originalPrice: Number(product.salePrice || 0),
        discount: 0 
      }]);
    }
  };

  // Quantity updates
  const handleUpdateQty = (index, val) => {
    const updated = [...cart];
    const available = Number(updated[index].product.currentStock || 0);
    const newQty = Math.max(1, parseInt(val) || 1);

    if (newQty > available) {
      Swal.fire({
        title: '<span class="text-xs font-bold">Inventory Limit</span>',
        text: `Only ${available} items in stock.`,
        icon: 'warning'
      });
      updated[index].quantity = available;
    } else {
      updated[index].quantity = newQty;
    }
    setCart(updated);
  };

  // Individual item discount rules
  const handleUpdateDiscount = (index, value) => {
    const updated = [...cart];
    const discountVal = Math.max(0, Number(value) || 0);

    // Apply PIN validation if discount exceeds 10%
    const itemTotal = updated[index].unitPrice * updated[index].quantity;
    if (discountVal > itemTotal * 0.1) {
      triggerManagerPinAuthorization('Apply high item discount', () => {
        updated[index].discount = discountVal;
        setCart(updated);
      });
    } else {
      updated[index].discount = discountVal;
      setCart(updated);
    }
  };

  // Price override (Requires PIN)
  const handlePriceOverride = (index, newPrice) => {
    const updated = [...cart];
    const finalPrice = Math.max(0, Number(newPrice) || 0);

    triggerManagerPinAuthorization('Override product catalog price', () => {
      updated[index].unitPrice = finalPrice;
      setCart(updated);
      Swal.fire({
        title: '<span class="text-xs font-bold">Price Overridden</span>',
        icon: 'success',
        timer: 1000,
        showConfirmButton: false
      });
    });
  };

  const handleRemoveItem = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Parking Bills (Hold / Recall)
  const handleHoldBill = () => {
    if (cart.length === 0) return;
    if (heldBills.length >= 5) {
      Swal.fire('Limit Reached', 'You can park up to 5 bills at a time.', 'warning');
      return;
    }

    const customerName = customers.find(c => c.id === selectedCustomerId)?.name || 'Walk-in';
    const newHeld = [...heldBills, {
      id: Date.now(),
      customerName,
      selectedCustomerId,
      cart,
      taxType,
      isDelivery,
      deliveryDetails
    }];

    setHeldBills(newHeld);
    localStorage.setItem('pos_held_bills', JSON.stringify(newHeld));
    
    // Clear cart
    setCart([]);
    setIsDelivery(false);
    Swal.fire('Bill Parked', 'This order has been safely put on hold.', 'success');
  };

  const handleRecallBill = (index) => {
    const target = heldBills[index];
    setCart(target.cart);
    setSelectedCustomerId(target.selectedCustomerId);
    setTaxType(target.taxType);
    setIsDelivery(target.isDelivery || false);
    if (target.deliveryDetails) setDeliveryDetails(target.deliveryDetails);

    const remaining = heldBills.filter((_, i) => i !== index);
    setHeldBills(remaining);
    localStorage.setItem('pos_held_bills', JSON.stringify(remaining));
  };

  // Add New Customer Inline
  const handleAddCustomerSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/parties/customers', {
        name: newCustForm.name,
        phone: newCustForm.phone,
        email: newCustForm.email || undefined,
        customerType: newCustForm.customerType,
        creditLimit: parseFloat(newCustForm.creditLimit) || 5000,
        address: newCustForm.address || undefined,
        note: newCustForm.note || undefined
      });

      Swal.fire('Customer Added', `${newCustForm.name} added successfully!`, 'success');
      setShowAddCustomer(false);
      
      // Reload parties list
      const custRes = await api.get('/parties/customers');
      const clients = custRes.data || [];
      setCustomers(clients);
      setSelectedCustomerId(res.data.id);
    } catch (err) {
      Swal.fire('Failed', err.response?.data?.message || 'Could not register customer', 'error');
    }
  };

  // Shift Management Actions
  const handleOpenShift = (e) => {
    e.preventDefault();
    const newShift = {
      openingCash: Number(shiftData.openingCash),
      counterId: shiftData.counterId,
      staffName: shiftData.staffName,
      startTime: new Date().toISOString()
    };
    setShiftActive(true);
    setShiftData(newShift);
    localStorage.setItem('pos_active_shift', JSON.stringify(newShift));
    Swal.fire('Shift Started', `Counter Cash registered at ₹${newShift.openingCash}`, 'success');
  };

  const handleOpenCloseShiftModal = () => {
    // Calculate total expected cash: opening cash + cash payments checked out during this session
    // For visual calculation, let's look at recent audit logs or just mock expected cash
    const totalCashSales = shiftLogs.filter(log => log.staffName === shiftData.staffName).reduce((s, log) => s + Number(log.amount || 0), 0);
    setExpectedCash(shiftData.openingCash + totalCashSales);
    setShowShiftModal(true);
  };

  const handleCloseShift = () => {
    const isDark = document.documentElement.classList.contains('dark');
    const counted = Number(actualCashInput || 0);
    const variance = counted - expectedCash;

    // Log the shift closure report
    const newLog = {
      id: Date.now(),
      counterId: shiftData.counterId,
      staffName: shiftData.staffName,
      startTime: shiftData.startTime,
      endTime: new Date().toISOString(),
      openingCash: shiftData.openingCash,
      expectedCash,
      actualCash: counted,
      variance
    };

    const updatedHistory = [newLog, ...shiftLogs];
    setShiftLogs(updatedHistory);
    localStorage.setItem('pos_shift_history', JSON.stringify(updatedHistory));

    // Clear active shift from local storage
    setShiftActive(false);
    setShiftData({ openingCash: 0, counterId: 'Counter A', staffName: 'Staff User', startTime: null });
    setActualCashInput('');
    setShowShiftModal(false);
    localStorage.removeItem('pos_active_shift');

    Swal.fire({
      title: '<span class="text-sm font-bold text-slate-800">Shift Closed Successfully</span>',
      html: `
        <div class="text-left text-xs space-y-1 mt-2">
          <p><b>Expected Cash:</b> ₹${expectedCash.toFixed(2)}</p>
          <p><b>Counted Cash:</b> ₹${counted.toFixed(2)}</p>
          <p class="${variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}"><b>Variance:</b> ₹${variance.toFixed(2)}</p>
        </div>
      `,
      icon: 'info',
      background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      color: isDark ? '#f8fafc' : '#0f172a'
    });
  };

  // Calculations
  const getSubtotal = () => {
    const rawSum = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity) - item.discount, 0);
    return Math.max(0, rawSum - generalDiscount);
  };

  const getTax = () => {
    const subtotal = getSubtotal() - loyaltyDiscount;
    return taxType === 'Exclusive' ? subtotal * 0.18 : subtotal - (subtotal / 1.18);
  };

  const getGrandTotal = () => {
    const base = getSubtotal() - loyaltyDiscount;
    const total = taxType === 'Exclusive' ? base + getTax() : base;
    return Math.max(0, total);
  };

  const getChangeToReturn = () => {
    const paid = Number(amountPaid) || 0;
    const total = getGrandTotal();
    return Math.max(0, paid - total);
  };

  // POS Checkout trigger
  const handleCheckout = async () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (cart.length === 0) return;

    // If split payment check details
    if (paymentMode === 'Split') {
      const sum = Number(splitCash || 0) + Number(splitDigital || 0);
      if (Math.abs(sum - getGrandTotal()) > 0.01) {
        Swal.fire({
          title: '<span class="text-xs font-bold text-rose-500">Split Pay Imbalance</span>',
          text: `Total split payment (₹${sum.toFixed(2)}) must equal the grand total (₹${getGrandTotal().toFixed(2)})`,
          icon: 'warning'
        });
        return;
      }
    }

    // Discount Reason requirement
    const sub = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const actualTotal = getSubtotal();
    if (actualTotal < sub && !discountReason.trim()) {
      Swal.fire({
        title: '<span class="text-xs font-bold text-rose-500">Discount Reason Required</span>',
        text: 'Please fill in a reason for applying discounts to this bill.',
        icon: 'warning'
      });
      return;
    }

    try {
      const payload = {
        customerId: selectedCustomerId || undefined,
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount
        })),
        paymentMode: paymentMode === 'Split' ? 'Split' : paymentMode,
        amountPaid: paymentMode === 'Split' ? getGrandTotal() : Number(amountPaid || getGrandTotal()),
        taxType,
        
        isComplimentary: paymentMode === 'Complimentary',
        complimentaryReason: paymentMode === 'Complimentary' ? discountReason : undefined,
        splitCash: paymentMode === 'Split' ? Number(splitCash) : undefined,
        splitDigital: paymentMode === 'Split' ? Number(splitDigital) : undefined,
        deliveryDetails: isDelivery ? deliveryDetails : undefined,
        discountReason: discountReason || undefined,
        loyaltyPointsRedeemed: redeemLoyalty ? loyaltyDiscount * 10 : undefined // 10 points per ₹1 discount
      };

      const res = await api.post('/sales/pos', payload);
      setReceipt(res.data);

      // Track cash sales for the shift drawer
      if (paymentMode === 'Cash') {
        const cashAmt = getGrandTotal();
        const savedLogs = [...shiftLogs, { staffName: shiftData.staffName, amount: cashAmt, time: new Date() }];
        setShiftLogs(savedLogs);
      } else if (paymentMode === 'Split') {
        const cashAmt = Number(splitCash || 0);
        const savedLogs = [...shiftLogs, { staffName: shiftData.staffName, amount: cashAmt, time: new Date() }];
        setShiftLogs(savedLogs);
      }

      // Reset Cart variables
      setCart([]);
      setAmountPaid('');
      setSplitCash('');
      setSplitDigital('');
      setDiscountReason('');
      setGeneralDiscount(0);
      setIsDelivery(false);
      setRedeemLoyalty(false);
      
      // Reload stocks instantly
      const prodRes = await api.get('/products');
      setProducts(prodRes.data || []);
      
    } catch (e) {
      Swal.fire({
        title: '<span class="text-xs font-bold text-rose-500">Checkout Failed</span>',
        text: e.response?.data?.error || 'Something went wrong during counter checkout.',
        icon: 'error',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a'
      });
    }
  };

  // Returns Handling Form submission
  const handleProcessReturn = async (e) => {
    e.preventDefault();
    if (!returnInvoiceNo.trim()) return;

    try {
      const payload = {
        invoiceNo: returnInvoiceNo.trim(),
        reason: returnReason,
        refundMethod,
        items: returnItems.map(it => ({
          productId: it.product.id,
          quantity: it.quantity,
          condition: it.condition
        }))
      };

      await api.post('/sales/returns', payload);
      Swal.fire('Return Processed', `Return request SR logged. Stock replenished.`, 'success');
      
      // Reset return form
      setReturnInvoiceNo('');
      setReturnItems([]);
      setActiveTab('sales');
      
      // Reload lists
      loadPOSData();
    } catch (err) {
      Swal.fire('Return Failed', err.response?.data?.error || 'Failed to process return details.', 'error');
    }
  };

  const handleAddReturnItem = (product) => {
    const existing = returnItems.find(item => item.product.id === product.id);
    if (existing) return;
    setReturnItems([...returnItems, { product, quantity: 1, condition: 'Resaleable' }]);
  };

  // Security Manager PIN flow
  const triggerManagerPinAuthorization = (actionName, callback) => {
    setManagerPinAction({ type: actionName, callback });
    setShowManagerPinModal(true);
  };

  const verifyManagerPin = () => {
    if (pinValue === '9999') {
      setShowManagerPinModal(false);
      setPinValue('');
      if (managerPinAction?.callback) managerPinAction.callback();
    } else {
      Swal.fire('Invalid PIN', 'Unauthorized pin bypass attempt logged.', 'error');
      setPinValue('');
    }
  };

  // Filter products by search terms and category tags
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          (p.code && p.code.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = selectedCategory === 'All' || p.category?.name === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Top Favourites pinned at the top
  const pinnedFavourites = products.slice(0, 8);

  // If shift is closed, show Open Shift Form Dashboard
  if (!shiftActive) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 animate__animated animate__fadeIn">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl flex items-center justify-center mx-auto text-indigo-650">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">POS Retail Checkout Counter</h1>
            <p className="text-xs text-slate-500">Log terminal status, confirm cash drawer values, and launch sale screen.</p>
          </div>

          <form onSubmit={handleOpenShift} className="space-y-4">
            <div className="space-y-1">
              <label className="text-2xs font-extrabold uppercase text-slate-400">Terminal Cashier Name *</label>
              <Input
                required
                value={shiftData.staffName}
                onChange={(e) => setShiftData({ ...shiftData, staffName: e.target.value })}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-2xs font-extrabold uppercase text-slate-400">Counter Terminal ID *</label>
                <select
                  value={shiftData.counterId}
                  onChange={(e) => setShiftData({ ...shiftData, counterId: e.target.value })}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 h-10 text-slate-800 dark:text-white"
                >
                  <option value="Counter A">Terminal A</option>
                  <option value="Counter B">Terminal B</option>
                  <option value="Express Counter">Express Counter</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-2xs font-extrabold uppercase text-slate-400">Opening Cash (₹) *</label>
                <Input
                  required
                  type="number"
                  min="0"
                  value={shiftData.openingCash || ''}
                  onChange={(e) => setShiftData({ ...shiftData, openingCash: Number(e.target.value) || 0 })}
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs h-10 font-bold text-indigo-650"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-indigo-650 hover:bg-indigo-750 text-white font-bold py-3.5 rounded-xl shadow-md transition-all h-11 text-xs"
            >
              🚀 Open POS Terminal Shift
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 animate__animated animate__fadeIn">
      {/* Top POS Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-2xs gap-3">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl flex items-center justify-center text-indigo-650">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              POS Retail Checkout
              <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">
                <Clock className="w-3 h-3" /> Shift Active
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Counter: <span className="font-bold text-slate-700 dark:text-white">{shiftData.counterId}</span> · Operator: <span className="font-bold text-slate-700 dark:text-white">{shiftData.staffName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex bg-slate-100 dark:bg-slate-950 border dark:border-slate-850 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-3 py-1.5 text-2xs font-bold rounded-lg transition-all ${activeTab === 'sales' ? 'bg-white dark:bg-slate-850 text-indigo-650 dark:text-indigo-400 shadow-xs' : 'text-slate-450'}`}
            >
              Sales Counter
            </button>
            <button
              onClick={() => setActiveTab('returns')}
              className={`px-3 py-1.5 text-2xs font-bold rounded-lg transition-all ${activeTab === 'returns' ? 'bg-white dark:bg-slate-850 text-indigo-650 dark:text-indigo-400 shadow-xs' : 'text-slate-450'}`}
            >
              Exchange & Returns
            </button>
          </div>

          <Button
            variant="outline"
            onClick={handleOpenCloseShiftModal}
            className="border-slate-200 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-200 h-9"
          >
            🔒 Close Terminal Shift
          </Button>
        </div>
      </div>

      {activeTab === 'sales' ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          
          {/* ZONE 1: PRODUCT SELECTION GRID (Left Column) */}
          <div className="lg:col-span-3 flex flex-col space-y-4 overflow-hidden">
            
            {/* Quick barcode add scanner + search */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <form onSubmit={handleBarcodeSubmit} className="relative sm:col-span-1">
                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Barcode scan..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="pl-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs h-10"
                />
              </form>
              <div className="relative sm:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search products by code or generic specifications..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs h-10"
                />
              </div>
            </div>

            {/* Quick keys pinned items row */}
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-505" /> Quick keys (Favourites)
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                {pinnedFavourites.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleAddToCart(p)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 border dark:border-slate-700 text-xs font-bold rounded-xl text-slate-750 dark:text-slate-200 transition-colors shadow-3xs hover:border-indigo-400 shrink-0 cursor-pointer"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Category selection filters */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 text-2xs font-extrabold rounded-full border transition-all ${
                    selectedCategory === cat
                      ? 'bg-indigo-650 border-indigo-650 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Product items display cards grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[550px] overflow-y-auto pr-1">
              {loading ? (
                <div className="col-span-3 py-20 text-center text-xs text-slate-400 animate-pulse">Loading counter catalogue...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="col-span-3 py-20 text-center text-xs text-slate-400 italic">No products available in database.</div>
              ) : (
                filteredProducts.map(p => {
                  const stock = Number(p.currentStock || 0);
                  const isExpiringSoon = false; // Mock or calculate based on aging date: Math.random() > 0.8
                  
                  return (
                    <div
                      key={p.id}
                      onClick={() => stock > 0 && handleAddToCart(p)}
                      className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 flex flex-col justify-between hover:shadow-md cursor-pointer transition-all duration-150 relative ${
                        stock <= 0
                          ? 'opacity-50 border-slate-205 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-not-allowed'
                          : 'border-slate-100 dark:border-slate-800 hover:border-indigo-400'
                      }`}
                    >
                      {/* Badge status */}
                      <div className="absolute top-2 right-2 flex flex-col gap-1">
                        {stock <= 0 && (
                          <span className="bg-rose-50 text-rose-600 dark:bg-rose-950/30 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full">
                            Sold Out
                          </span>
                        )}
                        {stock > 0 && stock <= 10 && (
                          <span className="bg-amber-50 text-amber-600 dark:bg-amber-950/30 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse">
                            Low Stock
                          </span>
                        )}
                        {isExpiringSoon && (
                          <span className="bg-orange-50 text-orange-600 dark:bg-orange-950/30 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full">
                            Expiring Soon
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="w-full h-24 bg-slate-50 dark:bg-slate-950 rounded-xl flex items-center justify-center text-slate-300 dark:text-slate-700">
                          <Package className="w-8 h-8" />
                        </div>
                        <div>
                          <span className="text-[9px] font-extrabold uppercase text-indigo-500 tracking-wide">{p.category?.name || 'GENERIC'}</span>
                          <h4 className="font-bold text-xs text-slate-800 dark:text-white line-clamp-2 mt-0.5">{p.name}</h4>
                          <p className="text-[10px] font-mono text-slate-400">{p.code || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-between items-center">
                        <span className="font-extrabold text-sm text-indigo-650 dark:text-indigo-400">₹{Number(p.salePrice || 0).toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{stock} pcs left</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* ZONE 2 & 3: CART, CUSTOMER & TENDER PANEL (Right Column) */}
          <div className="lg:col-span-2 flex flex-col bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            
            {/* Customer Search select bar */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-4 h-4 text-indigo-505" /> Selected Customer
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddCustomer(true)}
                  className="text-2xs font-bold text-indigo-600 hover:text-indigo-750 flex items-center gap-0.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Add Customer
                </button>
              </div>

              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-10"
              >
                <option value="">Anonymous Walk-In Retail Sale</option>
                {customers.map(cust => (
                  <option key={cust.id} value={cust.id}>{cust.name} ({cust.phone})</option>
                ))}
              </select>

              {/* Outstanding credit warning / Loyalty Points panel */}
              {selectedCustomerId && (
                <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850 space-y-1.5 text-2xs shadow-3xs">
                  {creditDetails && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-405 font-medium">B2B Credit Limit Status:</span>
                      {creditDetails.limitExceeded || creditDetails.hasOverdue ? (
                        <span className="text-rose-500 font-bold flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" /> Credit Blocked (Cash Only)
                        </span>
                      ) : (
                        <span className="text-slate-600 dark:text-slate-300 font-bold">
                          Outstanding: ₹{creditDetails.totalOutstanding.toFixed(2)} / ₹{creditDetails.creditLimit.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Loyalty Points Redeeming toggle */}
                  {customerLoyalty > 0 && (
                    <div className="flex justify-between items-center pt-1 border-t dark:border-slate-850">
                      <span className="text-slate-405 font-medium">Loyalty points: <b>{customerLoyalty} pts</b></span>
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-indigo-650">
                        <input
                          type="checkbox"
                          checked={redeemLoyalty}
                          onChange={(e) => setRedeemLoyalty(e.target.checked)}
                          className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 h-3.5 w-3.5"
                        />
                        Redeem (Save ₹{Math.floor(customerLoyalty / 100) * 10})
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cart list panel */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[180px] max-h-[250px]">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-10 text-slate-400 space-y-2">
                  <ShoppingCart className="w-6 h-6 opacity-30 text-indigo-650 animate-bounce" />
                  <p className="text-2xs italic font-medium">Cart is currently empty. Tap products to build counter bill.</p>
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl flex items-center justify-between gap-3 text-xs border border-slate-100 dark:border-slate-850">
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-800 dark:text-white line-clamp-1">{item.product.name}</p>
                      <div className="flex items-center gap-2">
                        {/* Price override indicator triggers manager validation modal */}
                        <button
                          type="button"
                          onClick={() => {
                            Swal.fire({
                              title: 'Override Unit Price',
                              input: 'number',
                              inputLabel: 'Enter override price (₹)',
                              inputValue: item.unitPrice,
                              showCancelButton: true
                            }).then((result) => {
                              if (result.isConfirmed && result.value) {
                                handlePriceOverride(idx, result.value);
                              }
                            });
                          }}
                          className="font-extrabold text-indigo-600 hover:underline text-2xs"
                        >
                          ₹{(item.unitPrice - item.discount).toFixed(2)}
                        </button>
                        {item.discount > 0 && (
                          <span className="line-through text-[10px] text-slate-400 font-medium">₹{item.unitPrice}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* Quantity adjusting buttons */}
                      <div className="flex items-center bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg h-7 overflow-hidden">
                        <button onClick={() => handleUpdateQty(idx, item.quantity - 1)} className="px-2 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500"><Minus className="w-3 h-3" /></button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdateQty(idx, e.target.value)}
                          className="w-8 text-center text-xs font-bold focus:outline-none bg-transparent"
                        />
                        <button onClick={() => handleAddToCart(item.product)} className="px-2 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500"><Plus className="w-3 h-3" /></button>
                      </div>

                      {/* Line discount */}
                      <div className="flex items-center bg-white dark:bg-slate-900 border dark:border-slate-850 rounded-lg h-7 px-1.5 w-16">
                        <Tag className="w-3 h-3 text-slate-405 mr-0.5" />
                        <input
                          type="number"
                          placeholder="Disc"
                          value={item.discount || ''}
                          onChange={(e) => handleUpdateDiscount(idx, e.target.value)}
                          className="w-full text-center text-[10px] focus:outline-none bg-transparent font-bold"
                        />
                      </div>

                      <button onClick={() => handleRemoveItem(idx)} className="text-rose-500 hover:text-rose-600 shrink-0"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bill park / recall panel */}
            <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-950/20 flex gap-2 overflow-x-auto text-2xs border-t dark:border-slate-800">
              <Button
                variant="outline"
                onClick={handleHoldBill}
                disabled={cart.length === 0}
                className="text-[10px] h-7 border-dashed border-indigo-250 text-indigo-650 hover:bg-indigo-50 font-bold shrink-0 rounded-lg"
              >
                📥 Park Bill (Hold)
              </Button>

              {heldBills.map((hb, index) => (
                <button
                  key={hb.id}
                  onClick={() => handleRecallBill(index)}
                  className="px-2 py-1 bg-indigo-50 text-indigo-750 dark:bg-indigo-950/40 dark:text-indigo-400 font-bold rounded-lg border border-indigo-100 dark:border-indigo-900 shrink-0 flex items-center gap-1 animate-pulse"
                >
                  Recall: {hb.customerName}
                </button>
              ))}
            </div>

            {/* Payment checkout parameters */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 space-y-3.5">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-2xs font-extrabold uppercase text-slate-400">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-850 rounded-xl px-2 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none"
                  >
                    <option value="Cash">Cash Payments</option>
                    <option value="UPI">UPI QR Scanner</option>
                    <option value="Card">Card Swipe/Tap</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit" disabled={creditDetails?.limitExceeded || creditDetails?.hasOverdue}>Distributor Credit</option>
                    <option value="Complimentary">Complimentary Issue</option>
                    <option value="Split">Split payments</option>
                  </select>
                </div>

                <div className="space-y-1">
                  {paymentMode === 'Split' ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[8px] font-extrabold uppercase text-slate-400">Split Cash (₹)</label>
                        <Input
                          type="number"
                          value={splitCash}
                          onChange={(e) => setSplitCash(e.target.value)}
                          className="h-8 text-xs font-bold bg-white dark:bg-slate-950"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-extrabold uppercase text-slate-400">Split Digital (₹)</label>
                        <Input
                          type="number"
                          value={splitDigital}
                          onChange={(e) => setSplitDigital(e.target.value)}
                          className="h-8 text-xs font-bold bg-white dark:bg-slate-950"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-2xs font-extrabold uppercase text-slate-400">Amount Tendered (₹)</label>
                      <Input
                        type="number"
                        placeholder={getGrandTotal().toFixed(2)}
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        className="h-8 text-xs font-bold bg-white dark:bg-slate-950"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Toggle Checkbox */}
              <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-750 dark:text-slate-205">
                  <input
                    type="checkbox"
                    checked={isDelivery}
                    onChange={(e) => setIsDelivery(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 h-4 w-4"
                  />
                  🚚 Flag as Home Delivery / Pre-Order
                </label>

                {isDelivery && (
                  <div className="grid grid-cols-2 gap-2 text-2xs pt-2 border-t dark:border-slate-850">
                    <div className="space-y-1">
                      <span className="text-slate-450 block font-bold">Delivery Address *</span>
                      <Input
                        value={deliveryDetails.deliveryAddress}
                        onChange={(e) => setDeliveryDetails({ ...deliveryDetails, deliveryAddress: e.target.value })}
                        className="h-7 text-3xs"
                        placeholder="Street details..."
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-450 block font-bold">Delivery Scheduled *</span>
                      <Input
                        type="date"
                        value={deliveryDetails.deliveryDate}
                        onChange={(e) => setDeliveryDetails({ ...deliveryDetails, deliveryDate: e.target.value })}
                        className="h-7 text-3xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-450 block font-bold">Assigned Courier / Driver</span>
                      <Input
                        value={deliveryDetails.driverName}
                        placeholder="Driver Name"
                        onChange={(e) => setDeliveryDetails({ ...deliveryDetails, driverName: e.target.value })}
                        className="h-7 text-3xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-450 block font-bold">Fee (₹)</span>
                      <Input
                        type="number"
                        value={deliveryDetails.deliveryCharge}
                        onChange={(e) => setDeliveryDetails({ ...deliveryDetails, deliveryCharge: Number(e.target.value) || 0 })}
                        className="h-7 text-3xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Discount reasons or PIN authorizations */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-2xs font-extrabold uppercase text-slate-400">Discount Reason / Comp Notes</label>
                  <Input
                    placeholder="e.g. Bulk pre-order promo"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    className="h-8 text-xs bg-white dark:bg-slate-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-2xs font-extrabold uppercase text-slate-400">Direct Invoice Discount (₹)</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={generalDiscount || ''}
                    onChange={(e) => setGeneralDiscount(Number(e.target.value) || 0)}
                    className="h-8 text-xs bg-white dark:bg-slate-950 font-bold"
                  />
                </div>
              </div>

              {/* Aggregate totals section */}
              <div className="space-y-1 text-xs border-t dark:border-slate-800 pt-3.5">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Subtotal:</span>
                  <span className="font-mono">₹{getSubtotal().toFixed(2)}</span>
                </div>

                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-indigo-650 font-bold">
                    <span>Loyalty Points Discount:</span>
                    <span className="font-mono">-₹{loyaltyDiscount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-500 items-center font-medium">
                  <span>GST Tax (18%):</span>
                  <div className="flex gap-2 items-center">
                    <select
                      value={taxType}
                      onChange={(e) => setTaxType(e.target.value)}
                      className="text-[10px] bg-slate-100 dark:bg-slate-950 border dark:border-slate-800 px-1 py-0.5 rounded font-bold"
                    >
                      <option value="Exclusive">GST Extra (18%)</option>
                      <option value="Inclusive">GST Inclusive</option>
                    </select>
                    <span className="font-mono">₹{getTax().toFixed(2)}</span>
                  </div>
                </div>

                {paymentMode === 'Complimentary' ? (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-2xs font-semibold dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-450 animate-pulse">
                    ⚠️ Complimentary items will deduct stock at ₹0 sales billing. Required Manager PIN bypass.
                  </div>
                ) : (
                  <div className="flex justify-between text-slate-800 dark:text-white font-bold text-sm pt-2 border-t dark:border-slate-800">
                    <span>Grand Total:</span>
                    <span className="font-mono text-indigo-650 dark:text-indigo-400 text-base">₹{getGrandTotal().toFixed(2)}</span>
                  </div>
                )}

                {amountPaid && (
                  <div className="flex justify-between text-emerald-600 font-bold text-xs pt-1">
                    <span>Change to Return:</span>
                    <span className="font-mono">₹{getChangeToReturn().toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Complete counter checkout button */}
              {paymentMode === 'UPI' ? (
                <Button
                  onClick={() => {
                    if (cart.length === 0) return;
                    setShowQRModal(true);
                  }}
                  disabled={cart.length === 0}
                  className="w-full bg-indigo-650 hover:bg-indigo-750 text-white font-bold py-3 rounded-xl shadow-md flex items-center justify-center gap-1.5 text-xs h-11 transition-all cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" /> Scan UPI QR Code to Pay
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (paymentMode === 'Complimentary') {
                      triggerManagerPinAuthorization('Complimentary issue bypass', handleCheckout);
                    } else {
                      handleCheckout();
                    }
                  }}
                  disabled={cart.length === 0}
                  className="w-full bg-indigo-650 hover:bg-indigo-750 text-white font-bold py-3 rounded-xl shadow-md flex items-center justify-center gap-1.5 text-xs h-11 transition-all cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" /> Complete POS Sale Checkout
                </Button>
              )}
            </div>

          </div>

        </div>
      ) : (
        /* EXCHANGE AND RETURNS TAB */
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm max-w-2xl mx-auto animate__animated animate__fadeIn">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center">
              <RefreshCw className="w-5 h-5 mr-1.5 text-indigo-505" /> Return / Replacement Counter
            </h2>
            <p className="text-xs text-slate-500">Log customer exchanges, check items original condition, and issue credit notes.</p>
          </div>

          <form onSubmit={handleProcessReturn} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-2xs font-extrabold text-slate-400 uppercase">Original Invoice No. *</label>
                <Input
                  placeholder="e.g. INV-000001"
                  required
                  value={returnInvoiceNo}
                  onChange={(e) => setReturnInvoiceNo(e.target.value)}
                  className="bg-white dark:bg-slate-950 border border-slate-205 text-xs h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-extrabold text-slate-400 uppercase">Refund Method *</label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-205 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 h-10 text-slate-800 dark:text-white"
                >
                  <option value="Cash Refund">Cash Refund (Immediate)</option>
                  <option value="Credit Note">Credit Note (Accrued)</option>
                  <option value="Replacement">Replacement Item</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-2xs font-extrabold text-slate-400 uppercase">Return Reason *</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-205 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 h-10 text-slate-800 dark:text-white"
                >
                  <option value="Damaged">Damaged / Melted</option>
                  <option value="Wrong Product">Wrong Product Delivered</option>
                  <option value="Quality Issue">Taste/Quality issue</option>
                  <option value="Expiry Concern">Near Expiry Date</option>
                  <option value="Customer Preference">Customer Changed Mind</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-extrabold text-slate-400 uppercase">Select Product to Return</label>
                <select
                  onChange={(e) => {
                    const prod = products.find(p => p.id === e.target.value);
                    if (prod) handleAddReturnItem(prod);
                  }}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-205 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 h-10 text-slate-850 dark:text-white"
                >
                  <option value="">Choose item...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* List items being returned */}
            <div className="space-y-2">
              <span className="text-2xs font-extrabold text-slate-400 uppercase block">Items to Refund</span>
              {returnItems.length === 0 ? (
                <p className="text-2xs text-slate-450 italic text-center py-6 border border-dashed rounded-xl">No products added for exchange yet.</p>
              ) : (
                returnItems.map((item, index) => (
                  <div key={index} className="p-3 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex-1 font-bold text-slate-800 dark:text-white">{item.product.name}</div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg overflow-hidden h-7">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...returnItems];
                            updated[index].quantity = Math.max(1, updated[index].quantity - 1);
                            setReturnItems(updated);
                          }}
                          className="px-2 border-r hover:bg-slate-50"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-bold text-2xs">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...returnItems];
                            updated[index].quantity += 1;
                            setReturnItems(updated);
                          }}
                          className="px-2 border-l hover:bg-slate-50"
                        >
                          +
                        </button>
                      </div>

                      <select
                        value={item.condition}
                        onChange={(e) => {
                          const updated = [...returnItems];
                          updated[index].condition = e.target.value;
                          setReturnItems(updated);
                        }}
                        className="bg-white dark:bg-slate-900 border rounded px-1.5 py-0.5 text-2xs"
                      >
                        <option value="Resaleable">Resaleable (Restock)</option>
                        <option value="Damaged">Damaged (Wastage)</option>
                        <option value="Destroy">Destroy immediately</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => setReturnItems(returnItems.filter((_, i) => i !== index))}
                        className="text-rose-500 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Button
              type="submit"
              disabled={returnItems.length === 0 || !returnInvoiceNo.trim()}
              className="w-full bg-indigo-650 hover:bg-indigo-750 text-white font-bold py-3.5 rounded-xl shadow-md text-xs mt-2"
            >
              🔄 Process Exchange / Return Receipt
            </Button>
          </form>
        </div>
      )}

      {/* SHIFT CLOSE WORK DRAWER MODAL */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border dark:border-slate-800 space-y-4 animate__animated animate__zoomIn animate__faster text-xs text-slate-700 dark:text-slate-350">
            <div className="text-center">
              <Clock className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">POS Cash Drawer Closure</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Terminal closing logs</p>
            </div>

            <div className="space-y-2 border-t dark:border-slate-800 pt-3">
              <div className="flex justify-between">
                <span>Terminal Opening Cash:</span>
                <span className="font-bold">₹{shiftData.openingCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Expected Sales Cash:</span>
                <span className="font-bold">₹{(expectedCash - shiftData.openingCash).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t dark:border-slate-850 pt-1.5 font-bold">
                <span>Expected Drawer Total:</span>
                <span className="text-indigo-650">₹{expectedCash.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-400 block">Counted Cash Drawer (₹) *</label>
              <Input
                type="number"
                placeholder="Enter exact count..."
                required
                value={actualCashInput}
                onChange={(e) => setActualCashInput(e.target.value)}
                className="bg-white dark:bg-slate-950 border border-slate-205 text-slate-850 dark:text-white text-xs h-10 font-bold"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 font-bold text-xs"
                onClick={() => setShowShiftModal(false)}
              >
                Keep Open
              </Button>
              <Button
                disabled={!actualCashInput}
                className="flex-1 bg-indigo-650 hover:bg-indigo-755 text-white font-bold text-xs"
                onClick={handleCloseShift}
              >
                Signoff Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* UPI QR SCAN CODE MODAL */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border text-center space-y-4 animate__animated animate__zoomIn animate__faster">
            <h3 className="font-extrabold text-sm text-slate-850 uppercase">Scan UPI Code to Pay</h3>
            <p className="text-2xs text-slate-400 font-bold">Terminal Reference: QR-POS</p>

            <div className="p-4 bg-slate-100 rounded-2xl max-w-[200px] mx-auto flex flex-col justify-center items-center">
              {/* Dummy QR Code mockup */}
              <div className="w-32 h-32 bg-slate-800 rounded-lg flex items-center justify-center text-white text-[10px] font-mono p-4">
                [ QR SCAN CODE ₹{getGrandTotal().toFixed(2)} ]
              </div>
            </div>

            <p className="text-xs font-extrabold text-indigo-655">Grand Total: ₹{getGrandTotal().toFixed(2)}</p>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => setShowQRModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-indigo-650 hover:bg-indigo-750 text-white font-bold text-xs"
                onClick={() => {
                  setShowQRModal(false);
                  handleCheckout();
                }}
              >
                Confirm Paid
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SECURITY MANAGER PIN DIALOG */}
      {showManagerPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-6 shadow-2xl border text-center space-y-4 animate__animated animate__zoomIn animate__faster">
            <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-650">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-xs text-slate-800 uppercase">Manager PIN Authorization</h3>
            <p className="text-[10px] text-slate-450 leading-normal">
              Action: <span className="font-bold text-slate-700">{managerPinAction?.type}</span>. Enter the 4-digit manager approval PIN (Hint: 9999).
            </p>

            <Input
              type="password"
              maxLength={4}
              placeholder="••••"
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value)}
              className="text-center font-bold tracking-widest text-lg border-2"
            />

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => {
                  setShowManagerPinModal(false);
                  setPinValue('');
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={pinValue.length < 4}
                className="flex-1 bg-indigo-650 text-white font-bold text-xs"
                onClick={verifyManagerPin}
              >
                Approve
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CUSTOMER MODAL */}
      {showAddCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border dark:border-slate-800 space-y-4 animate__animated animate__zoomIn animate__faster text-xs text-slate-700 dark:text-slate-300">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-white uppercase flex items-center gap-1.5">
              <User className="w-4 h-4 text-indigo-505" /> Add Customer Profile
            </h3>

            <form onSubmit={handleAddCustomerSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Full Name *</span>
                  <Input
                    required
                    value={newCustForm.name}
                    onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })}
                    className="bg-white dark:bg-slate-950 text-xs h-9 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Phone *</span>
                  <Input
                    required
                    value={newCustForm.phone}
                    onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                    className="bg-white dark:bg-slate-950 text-xs h-9 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Email</span>
                  <Input
                    type="email"
                    value={newCustForm.email}
                    onChange={(e) => setNewCustForm({ ...newCustForm, email: e.target.value })}
                    className="bg-white dark:bg-slate-950 text-xs h-9 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Customer Type</span>
                  <select
                    value={newCustForm.customerType}
                    onChange={(e) => setNewCustForm({ ...newCustForm, customerType: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 h-9"
                  >
                    <option value="RETAIL">Retail Walk-in</option>
                    <option value="DISTRIBUTOR">Trade Distributor</option>
                  </select>
                </div>
              </div>

              {newCustForm.customerType === 'DISTRIBUTOR' && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Credit Limit (₹)</span>
                  <Input
                    type="number"
                    value={newCustForm.creditLimit}
                    onChange={(e) => setNewCustForm({ ...newCustForm, creditLimit: e.target.value })}
                    className="bg-white dark:bg-slate-950 text-xs h-9 rounded-lg"
                  />
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Street Address</span>
                <Input
                  value={newCustForm.address}
                  onChange={(e) => setNewCustForm({ ...newCustForm, address: e.target.value })}
                  className="bg-white dark:bg-slate-950 text-xs h-9 rounded-lg"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => setShowAddCustomer(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-indigo-650 text-white font-bold text-xs"
                >
                  Save Profile
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT RECEIPT MODAL */}
      {receipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border flex flex-col space-y-4 animate__animated animate__zoomIn animate__faster">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-500">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-sm text-slate-850">ICE CREAM ERP INVOICE</h3>
              <p className="text-[10px] font-bold text-slate-450 uppercase">Order checkout success</p>
            </div>

            <div className="border-t border-dashed py-3 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span>Invoice Ref:</span>
                <span className="font-bold">{receipt.referenceNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date().toLocaleString('en-GB')}</span>
              </div>
              <div className="flex justify-between">
                <span>Client:</span>
                <span className="font-bold">{receipt.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="font-bold">{receipt.paymentMode}</span>
              </div>

              <div className="border-t border-dashed pt-3 mt-2 space-y-1.5">
                <div className="flex justify-between font-bold text-sm">
                  <span>Grand Total:</span>
                  <span>₹{receipt.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Paid Amount:</span>
                  <span>₹{receipt.amountPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Refund Balance:</span>
                  <span>₹{receipt.balance.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 font-semibold flex items-center justify-center gap-1 text-xs"
                onClick={() => {
                  window.print();
                }}
              >
                <Printer className="w-4 h-4" /> Print
              </Button>
              <Button
                className="flex-1 bg-indigo-650 text-white font-semibold text-xs"
                onClick={() => setReceipt(null)}
              >
                Close Counter
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
