import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import {
  ShoppingBag, Search, Plus, Minus, Trash2, ArrowLeft,
  CreditCard, Smartphone, Banknote, RefreshCw, Printer,
  PauseCircle, PlayCircle, CheckCircle2, User, Sparkles,
  QrCode, X, Layers, AlertCircle, Compass, Tag, Clock, Check,
  FileText, Download, Eye, ArrowRight, Globe, MapPin, SlidersHorizontal,
  Package, Boxes, ChevronRight, CheckSquare, Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import SearchSelect from '@/components/ui/SearchSelect';
import QuickAddCustomerModal from '@/components/forms/QuickAddCustomerModal';
import { generateThermalReceipt, generateA4TaxInvoice } from '@/utils/salesPdfGenerator';
import { getIndianStates, getStateCodeFromGstin, numberToWordsINR } from '@/utils/gstEngine';
import Swal from 'sweetalert2';

// Theme-adaptive Quantity Stepper component
const QuantitySelector = ({ value, onChange }) => {
  return (
    <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden w-full max-w-[105px] h-8 transition-colors">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="px-2.5 bg-slate-200/70 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs h-full flex items-center justify-center cursor-pointer transition-colors border-r border-slate-200 dark:border-slate-800 shrink-0"
      >
        -
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => {
          const cleanVal = e.target.value.replace(/[^0-9]/g, '');
          onChange(Math.max(1, parseInt(cleanVal, 10) || 1));
        }}
        className="w-full text-center bg-transparent border-0 font-mono font-bold text-xs focus:ring-0 text-slate-900 dark:text-white select-all focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="px-2.5 bg-slate-200/70 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs h-full flex items-center justify-center cursor-pointer transition-colors border-l border-slate-200 dark:border-slate-800 shrink-0"
      >
        +
      </button>
    </div>
  );
};

// Date-Time formatting helper
const formatLiveDateTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${mins}`;
};

export default function POSPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // Search & Filters (Properly structured into independent non-overlapping areas)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef(null);

  // Cart & Parking State
  const [cart, setCart] = useState([]);
  const [heldCarts, setHeldCarts] = useState([]);

  // Customer & Order Setup States
  const [customerId, setCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [taxRegNo, setTaxRegNo] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('Walk-In Customer Store Pickup');
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);

  // Order Mode & Payment Terms
  const [orderMode, setOrderMode] = useState('Retail POS'); // 'Retail POS' | 'Sales Order' | 'Quotation' | 'Invoice'
  const [paymentTerms, setPaymentTerms] = useState('Cash'); // 'Cash' | 'UPI' | 'Card' | 'Not Paid' | 'Paid' | 'Net 30'
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [cashTendered, setCashTendered] = useState('');

  // GST State & Tax Mode Intelligence ('AUTO' | 'INTRA' | 'INTER')
  const [taxMode, setTaxMode] = useState('AUTO');
  const [placeOfSupply, setPlaceOfSupply] = useState('33');

  // Live Clock & Order Timestamp
  const [orderDate, setOrderDate] = useState(new Date());
  const [isClockRunning, setIsClockRunning] = useState(true);

  // Charges & Tax Ledger States
  const [collectTax, setCollectTax] = useState(true);
  const [selectedGstRate, setSelectedGstRate] = useState(5); // Default 5%
  const gstRateOptions = [0, 5, 12, 18, 28];
  const [discountType, setDiscountType] = useState('Flat'); // 'Flat' (₹) | 'Percent' (%)
  const [discountValue, setDiscountValue] = useState('0');

  const [freight, setFreight] = useState('0');
  const [freightGst, setFreightGst] = useState(true);

  const [loadingCharges, setLoadingCharges] = useState('0');
  const [loadingGst, setLoadingGst] = useState(true);

  const [packingCharges, setPackingCharges] = useState('0');
  const [packingGst, setPackingGst] = useState(true);

  const [otherCharges, setOtherCharges] = useState('0');
  const [otherGst, setOtherGst] = useState(true);

  // Collapsible sections on Right Column to prevent overflow/overlay
  const [showCustomerSetup, setShowCustomerSetup] = useState(true);
  const [showChargesDetails, setShowChargesDetails] = useState(false);

  // Receipts and Modals
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [thermalReceiptUrl, setThermalReceiptUrl] = useState(null);
  const [a4InvoiceUrl, setA4InvoiceUrl] = useState(null);
  const [receiptMode, setReceiptMode] = useState('thermal'); // 'thermal' | 'a4'
  const [completedOrder, setCompletedOrder] = useState(null);

  // Indian States Reference
  const indianStates = getIndianStates();

  // Live Clock Interval
  useEffect(() => {
    if (!isClockRunning) return;
    const timer = setInterval(() => {
      setOrderDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [isClockRunning]);

  // Fetch Customers
  const { data: customers = [], refetch: refetchCustomers } = useQuery({
    queryKey: ['customers-pos-list'],
    queryFn: () => api.get('/parties/customers').then(r => r.data || []),
  });

  // Fetch Products with Auto-FEFO Expiring Batches
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['pos-products'],
    queryFn: () => api.get('/products/search', { params: { limit: 500 } }).then(r => r.data || []),
  });

  // Fetch Company Details for Receipts
  const { data: companyDetails = {} } = useQuery({
    queryKey: ['company-details'],
    queryFn: () => api.get('/setup/tax').then(r => r.data || {}),
  });

  // Resolve Seller State
  const sellerStateCode = companyDetails.stateCode || (companyDetails.companyGstin ? companyDetails.companyGstin.substring(0, 2) : '33');
  const sellerStateObj = indianStates.find(s => s.code === String(sellerStateCode)) || { code: '33', name: 'Tamil Nadu' };

  // Set default place of supply
  useEffect(() => {
    if (sellerStateCode && !taxRegNo) {
      setPlaceOfSupply(sellerStateCode);
    }
  }, [sellerStateCode]);

  // Derive unique categories with item counts
  const categoryCounts = React.useMemo(() => {
    const counts = { ALL: products.length };
    products.forEach(p => {
      const cat = p.category?.name || p.category || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [products]);

  const categories = ['ALL', ...Object.keys(categoryCounts).filter(c => c !== 'ALL')];

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const pCat = p.category?.name || p.category || 'Uncategorized';
    const matchesCat = selectedCategory === 'ALL' || pCat === selectedCategory;
    const matchesSearch = !searchQuery || 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.hsnCode && p.hsnCode.includes(searchQuery));
    return matchesCat && matchesSearch;
  });

  // Customer Selection Handler with Auto GSTIN State Resolution
  const handleSelectCustomer = (cId) => {
    setCustomerId(cId);
    const found = customers.find(c => c.id === cId);
    setSelectedCustomer(found || null);
    if (found) {
      setCustomerName(found.name || 'Walk-in Customer');
      setCustomerPhone(found.phone || '');
      const g = found.gstin || '';
      setTaxRegNo(g);
      if (g) {
        const derivedCode = getStateCodeFromGstin(g) || (g.length >= 2 ? g.substring(0, 2) : null);
        if (derivedCode && indianStates.some(s => s.code === derivedCode)) {
          setPlaceOfSupply(derivedCode);
        }
      }
      setDeliveryAddress(found.address || 'Walk-In Customer Store Pickup');
    } else {
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
      setTaxRegNo('');
      setDeliveryAddress('Walk-In Customer Store Pickup');
      setPlaceOfSupply(sellerStateCode);
    }
  };

  // GSTIN Manual Input Change Handler
  const handleGstinInputChange = (e) => {
    const val = e.target.value.toUpperCase();
    setTaxRegNo(val);
    const derivedCode = getStateCodeFromGstin(val) || (val.length >= 2 ? val.substring(0, 2) : null);
    if (derivedCode && indianStates.some(s => s.code === derivedCode)) {
      setPlaceOfSupply(derivedCode);
    }
  };

  // Add Item to Cart with Auto-FEFO Batch
  const handleAddToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          code: product.code,
          unitPrice: Number(product.salePrice || 0),
          discount: 0,
          quantity: 1,
          uomName: product.unit || 'pcs',
          hsnCode: product.hsnCode || '21050000',
          gstRate: Number(product.gstRate !== undefined && product.gstRate !== null ? product.gstRate : selectedGstRate),
          batchNo: product.nextExpiringBatch?.batchNo || '',
          batchId: product.nextExpiringBatch?.batchId || null,
          expiryDate: product.nextExpiringBatch?.expiryDate || null,
          remainingQty: product.nextExpiringBatch?.remainingQty || null
        }
      ];
    });
  };

  // Global GST Rate Change (0, 5, 12, 18, 28)
  const handleGlobalGstRateChange = (rate) => {
    setSelectedGstRate(rate);
    setCart(prev => prev.map(item => ({ ...item, gstRate: rate })));
  };

  // Barcode / SKU Scan Handler
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const query = barcodeInput.trim().toLowerCase();
    const matched = products.find(p => 
      p.code?.toLowerCase() === query || 
      p.name?.toLowerCase() === query ||
      (p.hsnCode && p.hsnCode.toLowerCase() === query)
    );

    if (matched) {
      handleAddToCart(matched);
      setBarcodeInput('');
    } else {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: `Product "${barcodeInput}" not found`,
        showConfirmButton: false,
        timer: 1500
      });
      setBarcodeInput('');
    }
  };

  // Cart Updates
  const handleUpdateQty = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const handleUpdateItemField = (productId, field, value) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  // -------------------------------------------------------------
  // INTELLIGENT TAX CALCULATION WITH GSTIN AUTO + MANUAL OVERRIDE
  // -------------------------------------------------------------
  const buyerStateCode = placeOfSupply || (taxRegNo?.length >= 2 ? taxRegNo.substring(0, 2) : sellerStateCode);
  const buyerStateObj = indianStates.find(s => s.code === String(buyerStateCode)) || { code: buyerStateCode, name: 'State ' + buyerStateCode };

  let isInterState = false;
  if (taxMode === 'INTRA') {
    isInterState = false;
  } else if (taxMode === 'INTER') {
    isInterState = true;
  } else {
    // 'AUTO' mode
    isInterState = String(sellerStateCode) !== String(buyerStateCode);
  }

  // Calculations for Charges & Tax Ledger
  const itemsTaxableSubtotal = cart.reduce((acc, it) => {
    const lineRate = Math.max(0, Number(it.unitPrice || 0) - Number(it.discount || 0));
    return acc + (lineRate * Number(it.quantity || 1));
  }, 0);

  // Global Discount
  const parsedDiscount = Number(discountValue) || 0;
  const calculatedDiscount = discountType === 'Percent'
    ? (itemsTaxableSubtotal * Math.min(100, Math.max(0, parsedDiscount))) / 100
    : Math.min(itemsTaxableSubtotal, parsedDiscount);

  const discountedGoodsSubtotal = Math.max(0, itemsTaxableSubtotal - calculatedDiscount);

  // Additional Charges
  const freightVal = Number(freight) || 0;
  const loadingVal = Number(loadingCharges) || 0;
  const packingVal = Number(packingCharges) || 0;
  const otherVal = Number(otherCharges) || 0;

  const taxableSubtotal = discountedGoodsSubtotal + freightVal + loadingVal + packingVal + otherVal;

  // GST Calculation
  let totalGstTax = 0;
  let cgstVal = 0;
  let sgstVal = 0;
  let igstVal = 0;

  if (collectTax) {
    const goodsRatio = itemsTaxableSubtotal > 0 ? discountedGoodsSubtotal / itemsTaxableSubtotal : 1;
    const goodsGst = cart.reduce((acc, it) => {
      const itemSub = Math.max(0, Number(it.unitPrice || 0) - Number(it.discount || 0)) * Number(it.quantity || 1);
      const effectiveItemSub = itemSub * goodsRatio;
      const rate = Number(it.gstRate !== undefined ? it.gstRate : selectedGstRate);
      return acc + (effectiveItemSub * (rate / 100));
    }, 0);

    const chargeGstRate = (selectedGstRate / 100);
    const freightGstVal = freightGst ? freightVal * chargeGstRate : 0;
    const loadingGstVal = loadingGst ? loadingVal * chargeGstRate : 0;
    const packingGstVal = packingGst ? packingVal * chargeGstRate : 0;
    const otherGstVal = otherGst ? otherVal * chargeGstRate : 0;

    totalGstTax = goodsGst + freightGstVal + loadingGstVal + packingGstVal + otherGstVal;

    if (isInterState) {
      igstVal = totalGstTax;
    } else {
      cgstVal = totalGstTax / 2;
      sgstVal = totalGstTax / 2;
    }
  }

  const rawGrandTotal = taxableSubtotal + totalGstTax;
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = (grandTotal - rawGrandTotal).toFixed(2);
  const grandTotalWords = numberToWordsINR(grandTotal);

  const tenderedNum = Number(cashTendered || 0);
  const changeDue = Math.max(0, tenderedNum - grandTotal);

  // Hold & Resume Cart
  const handleHoldCart = () => {
    if (cart.length === 0) return;
    setHeldCarts(prev => [
      ...prev,
      {
        id: Date.now(),
        customerName: customerName || 'Walk-in',
        customerId,
        customerPhone,
        taxRegNo,
        deliveryAddress,
        orderMode,
        paymentTerms,
        taxMode,
        placeOfSupply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cart: [...cart]
      }
    ]);
    setCart([]);
    setCashTendered('');
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: 'Current cart held on parking ticket',
      showConfirmButton: false,
      timer: 1500
    });
  };

  const handleResumeCart = (held) => {
    setCart(held.cart);
    setCustomerId(held.customerId || '');
    setCustomerName(held.customerName || 'Walk-in Customer');
    setCustomerPhone(held.customerPhone || '');
    setTaxRegNo(held.taxRegNo || '');
    setDeliveryAddress(held.deliveryAddress || 'Walk-In Customer Store Pickup');
    if (held.orderMode) setOrderMode(held.orderMode);
    if (held.paymentTerms) setPaymentTerms(held.paymentTerms);
    if (held.taxMode) setTaxMode(held.taxMode);
    if (held.placeOfSupply) setPlaceOfSupply(held.placeOfSupply);
    setHeldCarts(prev => prev.filter(h => h.id !== held.id));
  };

  // Checkout Mutation
  const checkoutMutation = useMutation({
    mutationFn: async (payload) => {
      let endpoint = '/orders/pos';
      if (orderMode === 'Sales Order') endpoint = '/orders/sales-order';
      else if (orderMode === 'Quotation') endpoint = '/orders/quotation';
      else if (orderMode === 'Invoice') endpoint = '/orders/invoice';
      
      const res = await api.post(endpoint, payload);
      return res.data;
    },
    onSuccess: (savedOrder) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
      setCompletedOrder(savedOrder);

      const enrichedOrder = {
        ...savedOrder,
        items: cart,
        taxableSubtotal,
        totalGstTax,
        cgst: cgstVal,
        sgst: sgstVal,
        igst: igstVal,
        discountAmount: calculatedDiscount,
        freight: freightVal,
        loadingCharges: loadingVal,
        packingCharges: packingVal,
        otherCharges: otherVal,
        roundOff: Number(roundOff),
        grandTotal,
        paymentMode,
        paymentTerms,
        orderDate,
        buyerStateCode
      };

      // Generate 80mm thermal receipt
      const thermalBlob = generateThermalReceipt(enrichedOrder, companyDetails);
      const thermalUrl = URL.createObjectURL(thermalBlob);
      setThermalReceiptUrl(thermalUrl);

      // Generate A4 Tax Invoice
      const a4Blob = generateA4TaxInvoice(enrichedOrder, companyDetails);
      const a4Url = URL.createObjectURL(a4Blob);
      setA4InvoiceUrl(a4Url);

      setShowReceiptModal(true);

      // Reset workspace
      setCart([]);
      setCashTendered('');
      setDiscountValue('0');
      setFreight('0');
      setLoadingCharges('0');
      setPackingCharges('0');
      setOtherCharges('0');
      setCustomerId('');
      setSelectedCustomer(null);
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
      setTaxRegNo('');
      setDeliveryAddress('Walk-In Customer Store Pickup');
      setTaxMode('AUTO');
    },
    onError: (err) => {
      Swal.fire({
        title: 'Checkout Failed',
        text: err?.response?.data?.error || err.message,
        icon: 'error'
      });
    }
  });

  const handleCheckout = () => {
    if (cart.length === 0) {
      Swal.fire('Empty Cart', 'Please add products before checking out.', 'warning');
      return;
    }

    const payload = {
      customerId: customerId || undefined,
      customerName: customerName || 'Walk-in Customer',
      customerPhone: customerPhone || '',
      type: orderMode === 'Retail POS' ? 'POS' : orderMode,
      deliveryDate: new Date().toISOString().split('T')[0],
      createdAt: orderDate.toISOString(),
      deliveryAddress: deliveryAddress || 'Walk-In Customer Store Pickup',
      paymentMode,
      paymentTerms,
      amountPaid: (paymentTerms === 'Paid' || paymentTerms === 'Cash' || paymentTerms === 'UPI' || paymentTerms === 'Card')
        ? (tenderedNum || grandTotal)
        : 0,
      collectTax,
      taxRegNo: taxRegNo || null,
      taxType: isInterState ? 'Inter-State' : 'Intra-State',
      placeOfSupply,
      discountValue: calculatedDiscount,
      freight: freightVal,
      freightGst,
      loadingCharges: loadingVal,
      loadingGst,
      packingCharges: packingVal,
      packingGst,
      otherCharges: otherVal,
      otherGst,
      cgst: cgstVal,
      sgst: sgstVal,
      igst: igstVal,
      roundOff: Number(roundOff),
      grandTotal,
      counterId: 'POS-COUNTER-01',
      items: cart.map(it => ({
        productId: it.productId,
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || 0),
        discount: Number(it.discount || 0),
        gstRate: it.gstRate,
        hsnCode: it.hsnCode,
        uomName: it.uomName,
        batchId: it.batchId,
        batchNo: it.batchNo,
        expiryDate: it.expiryDate
      }))
    };

    checkoutMutation.mutate(payload);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4.2rem)] max-w-[1720px] mx-auto text-slate-900 dark:text-slate-100">
      
      {/* 1. TOP POS HEADER STRIP */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0 shadow-2xs z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sales/list')}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Return to Sales"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-500" />
              Fast Retail POS Counter
              <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-black border border-emerald-200 dark:border-emerald-800 uppercase tracking-wide">
                Live Sales Terminal
              </span>
            </h1>
            <span className="text-[11px] text-slate-400 font-mono">
              Terminal: POS-01 • Seller: {sellerStateObj.name} ({sellerStateObj.code}) • Auto GST Engine
            </span>
          </div>
        </div>

        {/* Barcode Quick Scanner Input */}
        <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2 max-w-sm w-full mx-4">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan barcode or type SKU / HSN..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono shadow-inner"
            />
          </div>
        </form>

        {/* Actions & Navigation */}
        <div className="flex items-center gap-2">
          {heldCarts.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-xl text-xs text-amber-700 dark:text-amber-300">
              <PauseCircle className="w-3.5 h-3.5" />
              <span className="font-bold">{heldCarts.length} Held</span>
              <button
                type="button"
                onClick={() => handleResumeCart(heldCarts[0])}
                className="underline font-black ml-1 cursor-pointer hover:text-amber-900"
              >
                Resume
              </button>
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/sales/order')}
            className="text-xs border-slate-200 dark:border-slate-700 cursor-pointer font-bold"
          >
            📑 Sales Order (SAP B1) <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE (Left: Catalog with Clean Category & Filter Rows; Right: Cart & Pay) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 flex-1">
        
        {/* LEFT COLUMN: Categories, Search Filter & Product Cards Grid (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
          
          {/* A. PRODUCT SEARCH & CATALOG FILTER BAR (Clean, Non-overlapping) */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 space-y-3">
            
            {/* Search Input Row with clear button and item counter */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products by name, code, or HSN code..."
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-9 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl shrink-0 border border-slate-200 dark:border-slate-700">
                {filteredProducts.length} items
              </span>
            </div>

            {/* B. CATEGORY SELECTOR STRIP (Dedicated Row with Clean Pills & Counts, Never Overlays) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-emerald-500" /> Catalog Categories
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  Active Filter: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{selectedCategory}</strong>
                </span>
              </div>

              {/* Horizontal Scrollable Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {categories.map(cat => {
                  const isSelected = selectedCategory === cat;
                  const count = categoryCounts[cat] || 0;

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs scale-102'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                      }`}
                    >
                      <span>{cat}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        isSelected 
                          ? 'bg-emerald-700/80 text-white' 
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* C. PRODUCT ITEMS TOUCH GRID with Auto-FEFO Allocation & Clear "Add to Cart" Actions */}
          <div className="p-3.5 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
            {isLoading ? (
              <div className="col-span-full py-16 text-center text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                Loading fast catalog & Auto-FEFO stock...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-400 text-xs italic bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8">
                <Package className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                No products found matching "{searchQuery}" in category "{selectedCategory}".
              </div>
            ) : (
              filteredProducts.map(p => {
                const nextBatch = p.nextExpiringBatch;
                const hasBatch = Boolean(nextBatch && nextBatch.batchNo);
                const isExpDate = nextBatch?.expiryDate ? new Date(nextBatch.expiryDate).toLocaleDateString('en-GB') : null;
                const inCart = cart.find(c => c.productId === p.id);

                return (
                  <div
                    key={p.id}
                    onClick={() => handleAddToCart(p)}
                    className={`bg-white dark:bg-slate-900 border rounded-2xl p-3 cursor-pointer transition-all shadow-xs hover:shadow-md flex flex-col justify-between group active:scale-[0.98] relative ${
                      inCart 
                        ? 'border-emerald-500 ring-1 ring-emerald-500/30' 
                        : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-mono font-black shadow-xs">
                        {inCart.quantity}
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                        <span className="font-bold">{p.code}</span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${
                          (p.currentStock || 0) > 10
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                        }`}>
                          Qty: {p.currentStock || 0}
                        </span>
                      </div>
                      
                      <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {p.name}
                      </h3>

                      {/* Auto-FEFO Allocation Batch & Expiry Display */}
                      {hasBatch ? (
                        <div className="mt-1 space-y-0.5">
                          <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold">
                            ⚡ FEFO: {nextBatch.batchNo}
                          </span>
                          {isExpDate && (
                            <span className="block text-[9px] font-mono text-slate-400">
                              Exp: {isExpDate} ({nextBatch.remainingQty} pcs)
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded text-[9px] font-mono">
                            📦 Direct Stock
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-2 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          ₹{Number(p.salePrice || 0).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          +{p.gstRate || 18}% GST
                        </span>
                      </div>

                      {/* Explicit Add to Cart Button (matches reference design) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(p);
                        }}
                        className="w-full py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/60 dark:hover:bg-emerald-600 dark:text-emerald-300 rounded-xl text-3xs font-extrabold transition-all border border-emerald-200 dark:border-emerald-800 cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add to Order
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Customer, Cart & Intelligent Tax Desk (5 Cols, Non-overlapping) */}
        <div className="lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
          
          {/* Card 1: Customer & GST Setup (With collapse toggle so it never covers cart lines) */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shrink-0 space-y-2.5">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-emerald-500" /> Customer & Order Setup
              </h3>
              <div className="flex items-center gap-2">
                {selectedCustomer && (
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                    selectedCustomer.customerType === 'B2B' 
                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' 
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {selectedCustomer.customerType || 'B2B'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowCustomerSetup(!showCustomerSetup)}
                  className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer p-0.5"
                >
                  {showCustomerSetup ? 'Hide ▲' : 'Show ▼'}
                </button>
              </div>
            </div>

            {showCustomerSetup && (
              <div className="space-y-2.5">
                {/* Customer Select + Quick Add */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                      Customer Party *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowQuickAddModal(true)}
                      className="text-3xs font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800"
                    >
                      <Plus className="w-3 h-3" /> Quick Add (+91)
                    </button>
                  </div>
                  <SearchSelect
                    value={customerId}
                    onChange={handleSelectCustomer}
                    options={customers.map(c => {
                      const isB2B = c.customerType === 'B2B' || c.customerType === 'DISTRIBUTOR' || c.customerType === 'WHOLESALE';
                      return {
                        value: c.id,
                        label: `${c.name} [${isB2B ? 'B2B' : 'Retail'}]`,
                        subLabel: `${c.phone || ''} ${c.gstin ? '• GSTIN: ' + c.gstin : ''}`.trim() || null
                      };
                    })}
                    placeholder="Walk-in Customer / Select..."
                    searchPlaceholder="Search by name / phone / GSTIN / B2B..."
                    required
                    triggerClassName="h-8.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                {/* GSTIN & 3-Way Mode Switcher */}
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                      Customer GSTIN
                    </label>
                    <div className="flex items-center gap-1">
                      {['AUTO', 'INTRA', 'INTER'].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setTaxMode(m)}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                            taxMode === m 
                              ? 'bg-emerald-600 text-white shadow-2xs' 
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {m === 'AUTO' ? '⚡ Auto' : m === 'INTRA' ? '🏛️ CGST+SGST' : '🌐 IGST'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="e.g. 33AAAAA0000A1Z5"
                      value={taxRegNo}
                      onChange={handleGstinInputChange}
                      className="h-8 text-xs font-mono font-bold uppercase tracking-wider bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />

                    <select
                      value={placeOfSupply}
                      onChange={(e) => setPlaceOfSupply(e.target.value)}
                      className="h-8 text-xs font-semibold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 text-slate-900 dark:text-white focus:outline-emerald-500 cursor-pointer"
                    >
                      {indianStates.map(state => (
                        <option key={state.code} value={state.code}>
                          POS: {state.code} - {state.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* State Status Banner */}
                  <div className={`p-1.5 px-2.5 rounded-lg border flex items-center justify-between text-[11px] ${
                    isInterState
                      ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    <span className="font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {isInterState ? 'Inter-State Supply (IGST)' : 'Intra-State Supply (CGST + SGST)'}
                    </span>
                    <span className="font-mono text-[10px] opacity-80">
                      {buyerStateObj.name} ({buyerStateObj.code})
                    </span>
                  </div>
                </div>

                {/* Order Mode & Timestamp */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Order Mode</label>
                    <SearchSelect
                      value={orderMode}
                      onChange={setOrderMode}
                      options={[
                        { value: 'Retail POS', label: 'Retail POS' },
                        { value: 'Sales Order', label: 'Sales Order' },
                        { value: 'Quotation', label: 'Quotation' },
                        { value: 'Invoice', label: 'Tax Invoice' }
                      ]}
                      showSearch={false}
                      placeholder="Select Type..."
                      required
                      triggerClassName="h-8 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Timestamp</label>
                      <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatLiveDateTime(orderDate).split(' ')[1] || 'LIVE'}
                      </span>
                    </div>
                    <DatePicker
                      required
                      showTime
                      value={orderDate}
                      onChange={(date) => {
                        setIsClockRunning(false);
                        setOrderDate(date || new Date());
                      }}
                      modalTitle="Select Order Timestamp"
                      placeholder="DD-MM-YYYY"
                      className="space-y-0"
                      triggerClassName="h-8 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white w-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Selected Item Lines (Dedicated non-overlapping container) */}
          <div className="p-3.5 space-y-2.5 flex-1 min-h-[180px] max-h-[380px] overflow-y-auto">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-emerald-500" /> Selected Item Lines
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-black text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {cart.length} Lines
                </span>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={handleHoldCart}
                    className="text-[11px] text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                  >
                    Hold
                  </button>
                )}
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-slate-400 hover:text-rose-500 cursor-pointer p-0.5"
                    title="Clear All Lines"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Empty State or Items List */}
            {cart.length === 0 ? (
              <div className="py-8 text-center text-slate-400 dark:text-slate-500 italic text-xs border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40">
                Click products from the catalog to add items here.
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item, idx) => {
                  const lineSubtotal = (Number(item.unitPrice || 0) - Number(item.discount || 0)) * Number(item.quantity || 1);

                  return (
                    <div key={item.productId || idx} className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex justify-between items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                            {item.productName} <span className="text-[9px] text-slate-400 font-mono">({item.code})</span>
                          </h4>
                          {/* Auto-FEFO Allocation Batch & Expiry Display */}
                          {item.batchNo ? (
                            <div className="text-[9px] font-mono font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                              ⚡ Batch: {item.batchNo} {item.expiryDate ? `• Exp: ${new Date(item.expiryDate).toLocaleDateString('en-GB')}` : ''}
                            </div>
                          ) : (
                            <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                              📦 Direct Finished Stock
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 p-1 cursor-pointer shrink-0"
                          onClick={() => handleRemoveFromCart(item.productId)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 items-end">
                        <div className="space-y-0.5">
                          <label className="text-[8px] font-bold text-slate-400 uppercase block">Qty</label>
                          <QuantitySelector
                            value={item.quantity}
                            onChange={(val) => handleUpdateQty(item.productId, val - item.quantity)}
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[8px] font-bold text-slate-400 uppercase block">Price (₹)</label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItemField(item.productId, 'unitPrice', e.target.value)}
                            className="font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-8 rounded-xl text-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[8px] font-bold text-slate-400 uppercase block">Disc (₹)</label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={item.discount}
                            onChange={(e) => handleUpdateItemField(item.productId, 'discount', e.target.value)}
                            className="font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-8 rounded-xl text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-900 text-[10px] font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">GST:</span>
                          <select
                            value={item.gstRate !== undefined ? item.gstRate : selectedGstRate}
                            onChange={(e) => handleUpdateItemField(item.productId, 'gstRate', Number(e.target.value))}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                          >
                            {gstRateOptions.map(r => (
                              <option key={r} value={r}>{r}%</option>
                            ))}
                          </select>
                        </div>
                        <span className="text-slate-500">
                          Subtotal: <strong className="text-slate-800 dark:text-white font-mono">₹{lineSubtotal.toFixed(2)}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card 3: Charges, Tax Ledger & Checkout (Pinned/Docked at Bottom, Never Overlays) */}
          <div className="p-3.5 space-y-2.5 shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center pb-1 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-emerald-500" /> Charges & Tax Ledger
              </h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowChargesDetails(!showChargesDetails)}
                  className="text-[10px] text-slate-500 hover:underline cursor-pointer"
                >
                  {showChargesDetails ? 'Hide Charges ▲' : '+ Charges / Discount ▼'}
                </button>
                <label className="flex items-center gap-1 text-3xs font-extrabold cursor-pointer text-slate-700 dark:text-slate-300">
                  <input 
                    type="checkbox" 
                    checked={collectTax} 
                    onChange={() => setCollectTax(!collectTax)}
                    className="rounded border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 accent-emerald-600 w-3.5 h-3.5"
                  />
                  GST {collectTax ? 'ON' : 'OFF'}
                </label>
              </div>
            </div>

            {/* Collapsible Charges Area */}
            {showChargesDetails && (
              <div className="space-y-2 pt-1 border-b border-slate-100 dark:border-slate-800 pb-2">
                {/* GST Rate Slabs Selector */}
                {collectTax && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">GST Rate:</span>
                    <div className="flex items-center gap-1 overflow-x-auto bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                      {gstRateOptions.map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => handleGlobalGstRateChange(rate)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                            selectedGstRate === rate
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                          }`}
                        >
                          {rate}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Discount: ₹ / % toggle + input */}
                <div className="flex gap-2 items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Discount:</span>
                  <div className="flex bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDiscountType('Flat')}
                      className={`px-2 py-0.5 text-3xs font-extrabold rounded cursor-pointer ${discountType === 'Flat' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
                    >
                      ₹
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('Percent')}
                      className={`px-2 py-0.5 text-3xs font-extrabold rounded cursor-pointer ${discountType === 'Percent' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
                    >
                      %
                    </button>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder="0"
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white h-7.5 text-xs font-mono font-bold"
                  />
                </div>

                {/* Additional Charges Grid with GST Checkboxes */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                      <span>Freight (₹)</span>
                      <label className="cursor-pointer flex items-center gap-0.5">
                        <input type="checkbox" checked={freightGst} onChange={() => setFreightGst(!freightGst)} className="w-2.5 h-2.5 accent-emerald-600" /> GST
                      </label>
                    </div>
                    <Input type="number" min="0" value={freight} onChange={(e) => setFreight(e.target.value)} placeholder="0" className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                      <span>Loading (₹)</span>
                      <label className="cursor-pointer flex items-center gap-0.5">
                        <input type="checkbox" checked={loadingGst} onChange={() => setLoadingGst(!loadingGst)} className="w-2.5 h-2.5 accent-emerald-600" /> GST
                      </label>
                    </div>
                    <Input type="number" min="0" value={loadingCharges} onChange={(e) => setLoadingCharges(e.target.value)} placeholder="0" className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                      <span>Packing (₹)</span>
                      <label className="cursor-pointer flex items-center gap-0.5">
                        <input type="checkbox" checked={packingGst} onChange={() => setPackingGst(!packingGst)} className="w-2.5 h-2.5 accent-emerald-600" /> GST
                      </label>
                    </div>
                    <Input type="number" min="0" value={packingCharges} onChange={(e) => setPackingCharges(e.target.value)} placeholder="0" className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                      <span>Other (₹)</span>
                      <label className="cursor-pointer flex items-center gap-0.5">
                        <input type="checkbox" checked={otherGst} onChange={() => setOtherGst(!otherGst)} className="w-2.5 h-2.5 accent-emerald-600" /> GST
                      </label>
                    </div>
                    <Input type="number" min="0" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} placeholder="0" className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono" />
                  </div>
                </div>
              </div>
            )}

            {/* Calculations Summary Box */}
            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 text-xs font-semibold">
              <div className="flex justify-between text-slate-500">
                <span>Taxable Subtotal:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">₹{taxableSubtotal.toFixed(2)}</span>
              </div>
              {calculatedDiscount > 0 && (
                <div className="flex justify-between text-rose-500">
                  <span>Discount:</span>
                  <span className="font-mono">-₹{calculatedDiscount.toFixed(2)}</span>
                </div>
              )}
              {collectTax && (
                <div className="space-y-0.5 border-t border-slate-200/60 dark:border-slate-800 pt-1">
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>GST Tax ({isInterState ? `IGST ${selectedGstRate}%` : `CGST+SGST ${selectedGstRate}%`}):</span>
                    <span className="font-mono">₹{totalGstTax.toFixed(2)}</span>
                  </div>
                  {isInterState ? (
                    <div className="flex justify-between text-[11px] text-purple-600 dark:text-purple-400 pl-2">
                      <span>• IGST:</span>
                      <span className="font-mono font-bold">₹{igstVal.toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 pl-2">
                        <span>• CGST (@{selectedGstRate / 2}%):</span>
                        <span className="font-mono">₹{cgstVal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 pl-2">
                        <span>• SGST (@{selectedGstRate / 2}%):</span>
                        <span className="font-mono">₹{sgstVal.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-emerald-600 dark:text-emerald-400 border-t border-slate-200 dark:border-slate-800 pt-1.5">
                <span>Grand Total:</span>
                <span className="font-mono text-base">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-[10px] text-slate-400 italic line-clamp-1">
                {grandTotalWords}
              </p>
            </div>

            {/* POS Cashier Quick Tender & Payment Selector */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'Cash', icon: Banknote },
                  { id: 'UPI', icon: QrCode },
                  { id: 'Card', icon: CreditCard },
                  { id: 'Split', icon: Layers }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setPaymentMode(m.id);
                      if (paymentTerms === 'Not Paid' || paymentTerms === 'Cash' || paymentTerms === 'UPI' || paymentTerms === 'Card') {
                        setPaymentTerms(m.id);
                      }
                    }}
                    className={`py-1.5 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                      paymentMode === m.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <m.icon className="w-3.5 h-3.5" />
                    {m.id}
                  </button>
                ))}
              </div>

              {/* Fast Cash Tender Shortcuts */}
              {paymentMode === 'Cash' && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {[100, 200, 500, 2000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCashTendered(String(val))}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500 cursor-pointer"
                      >
                        ₹{val}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashTendered(String(grandTotal))}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 cursor-pointer"
                    >
                      Exact
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-2 text-xs text-slate-400">₹</span>
                      <Input
                        type="number"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        placeholder="Cash Tendered"
                        className="h-8 pl-6 text-xs font-mono font-bold bg-white dark:bg-slate-950"
                      />
                    </div>
                    {changeDue > 0 && (
                      <div className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-300 font-mono">
                        Change: ₹{changeDue.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Complete Checkout Button */}
              <Button
                type="button"
                disabled={cart.length === 0 || checkoutMutation.isPending}
                onClick={handleCheckout}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl shadow-lg shadow-emerald-600/20 text-xs flex items-center justify-center gap-2 cursor-pointer h-11"
              >
                {checkoutMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing & Allocating Stock...
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    Print Receipt & Complete (₹{grandTotal.toLocaleString('en-IN')})
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Customer Modal */}
      {showQuickAddModal && (
        <QuickAddCustomerModal
          onClose={() => setShowQuickAddModal(false)}
          onAdded={(newCust) => {
            refetchCustomers();
            handleSelectCustomer(newCust.id);
          }}
        />
      )}

      {/* Dual Vector Receipt & Invoice Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-500" />
                <div>
                  <h3 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                    Order Placed: {completedOrder?.docNo || completedOrder?.referenceNo}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Mode: {orderMode} • Total: ₹{grandTotal.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Receipt Mode Switcher */}
              <div className="flex items-center gap-2">
                <div className="inline-flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setReceiptMode('thermal')}
                    className={`px-2.5 py-1 text-3xs font-extrabold rounded-md cursor-pointer transition-all ${
                      receiptMode === 'thermal' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    80mm Thermal POS
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptMode('a4')}
                    className={`px-2.5 py-1 text-3xs font-extrabold rounded-md cursor-pointer transition-all ${
                      receiptMode === 'a4' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    A4 Tax Invoice
                  </button>
                </div>

                <button 
                  onClick={() => setShowReceiptModal(false)} 
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Document Preview Frame */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 overflow-hidden flex items-center justify-center">
              <iframe 
                src={receiptMode === 'thermal' ? thermalReceiptUrl : a4InvoiceUrl} 
                className="w-full h-[500px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white" 
                title="Order Receipt Preview" 
              />
            </div>

            {/* Modal Bottom Buttons */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">
                Ready for thermal printer or laser spooler
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const url = receiptMode === 'thermal' ? thermalReceiptUrl : a4InvoiceUrl;
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${completedOrder?.docNo || 'Receipt'}.pdf`;
                    a.click();
                  }}
                  className="text-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Download
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const url = receiptMode === 'thermal' ? thermalReceiptUrl : a4InvoiceUrl;
                    window.open(url);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs cursor-pointer font-bold"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" /> Open / Print
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
