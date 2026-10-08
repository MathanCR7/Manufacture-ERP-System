import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import {
  ShoppingCart, FileText, ShoppingBag, Plus, Minus, Trash2, Printer, Check, X,
  AlertTriangle, ArrowRight, Building2, Calendar, Truck, DollarSign, Percent,
  ChevronDown, ChevronUp, RefreshCw, Search, Upload, ArrowLeft, ShieldAlert,
  Sparkles, Layers, Receipt, Clock, CheckCircle2, Download, Tag, UserPlus, Eye,
  Compass, Package, CreditCard, Banknote, HelpCircle, ShieldCheck, Info,
  SlidersHorizontal, CheckSquare, Square, CornerDownLeft, Globe, MapPin,
  QrCode, PauseCircle, PlayCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from '@/components/ui/DatePicker';
import SearchSelect from '@/components/ui/SearchSelect';
import QuickAddCustomerModal from '@/components/forms/QuickAddCustomerModal';
import ProductStockQueryModal from '@/modules/production/components/ProductStockQueryModal';
import { calculateGST, numberToWordsINR, getIndianStates, getStateCodeFromGstin } from '@/utils/gstEngine';
import { generateA4TaxInvoice, generateThermalReceipt } from '@/utils/salesPdfGenerator';
import Swal from 'sweetalert2';

// Theme-adaptive Quantity Selector component
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

// Live Date-Time formatting helper
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

export default function SalesBillingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editOrderId = searchParams.get('edit') || (searchParams.get('mode') === 'edit' ? searchParams.get('id') : null);
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [editingOrderDocNo, setEditingOrderDocNo] = useState('');
  const queryClient = useQueryClient();

  // Search & Catalog Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Stock Query Modal State
  const [stockQueryProductId, setStockQueryProductId] = useState(null);
  const [isStockQueryOpen, setIsStockQueryOpen] = useState(false);

  // Customer & Order Setup States
  const [customerId, setCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  
  // Document Mode: Dedicated Walk-in POS
  const [orderType, setOrderType] = useState('POS');
  const [paymentTerms, setPaymentTerms] = useState('Immediate / Cash');
  
  // Live Clock & Order Timestamp
  const [orderDate, setOrderDate] = useState(new Date());
  const [isClockRunning, setIsClockRunning] = useState(true);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);

  // Tax Registration & Addresses
  const [taxRegNo, setTaxRegNo] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [lrNo, setLrNo] = useState('');

  // GST State & Tax Mode Intelligence ('AUTO' | 'INTRA' | 'INTER')
  const [taxMode, setTaxMode] = useState('AUTO');
  const [placeOfSupply, setPlaceOfSupply] = useState('33'); // Default 33 - Tamil Nadu

  // Selected Item Lines
  const [items, setItems] = useState([]);

  // Charges & Tax Ledger States
  const [collectTax, setCollectTax] = useState(true);
  const [selectedGstRate, setSelectedGstRate] = useState(5); // Default 5%
  const gstRateOptions = [0, 5, 12, 18, 28];
  const [discountType, setDiscountType] = useState('Flat'); // 'Flat' (₹) or 'Percent' (%)
  const [discountValue, setDiscountValue] = useState('0');

  const [freight, setFreight] = useState('0');
  const [freightGst, setFreightGst] = useState(true);

  const [loadingCharges, setLoadingCharges] = useState('0');
  const [loadingGst, setLoadingGst] = useState(true);

  const [packingCharges, setPackingCharges] = useState('0');
  const [packingGst, setPackingGst] = useState(true);

  const [otherCharges, setOtherCharges] = useState('0');
  const [otherGst, setOtherGst] = useState(true);

  // Print & Receipt Modal States
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [pdfPreviewUrlA4, setPdfPreviewUrlA4] = useState(null);
  const [pdfPreviewUrlPOS, setPdfPreviewUrlPOS] = useState(null);
  const [previewMode, setPreviewMode] = useState('A4'); // 'A4' or 'POS'
  const [completedOrder, setCompletedOrder] = useState(null);

  // Indian States Reference
  const indianStates = getIndianStates();

  // Live Timer Interval
  useEffect(() => {
    if (!isClockRunning) return;
    const timer = setInterval(() => {
      setOrderDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [isClockRunning]);

  // Sync Document Mode or Edit Order from Query Params
  useEffect(() => {
    if (editOrderId) {
      api.get(`/orders/${editOrderId}`).then(res => {
        const ord = res.data;
        if (!ord) return;
        setEditingOrderDocNo(ord.docNo || ord.referenceNo || '');
        setOrderType(ord.type || 'POS');
        setCustomerId(ord.customerId || '');
        setSelectedCustomer(ord.customer || null);
        if (ord.taxRegNo || ord.customer?.gstin) {
          const g = ord.taxRegNo || ord.customer?.gstin;
          setTaxRegNo(g);
          const code = getStateCodeFromGstin(g) || (g.length >= 2 ? g.substring(0, 2) : null);
          if (code && indianStates.some(s => s.code === code)) {
            setPlaceOfSupply(code);
          }
        } else if (ord.placeOfSupply) {
          setPlaceOfSupply(ord.placeOfSupply);
        }
        if (ord.deliveryAddress) setDeliveryAddress(ord.deliveryAddress);
        if (ord.paymentTerms) setPaymentTerms(ord.paymentTerms);
        if (ord.internalNote) setInternalNote(ord.internalNote);
        if (ord.transporterName) setTransporterName(ord.transporterName);
        if (ord.vehicleNo) setVehicleNo(ord.vehicleNo);
        if (ord.lrNo) setLrNo(ord.lrNo);
        if (ord.createdAt) {
          setOrderDate(new Date(ord.createdAt));
          setIsClockRunning(false);
        }
        if (ord.deliveryDate) {
          setDeliveryDate(ord.deliveryDate.split('T')[0]);
        }
        setFreight(String(ord.freight || 0));
        setFreightGst(ord.freightGst !== undefined ? Boolean(ord.freightGst) : true);
        setLoadingCharges(String(ord.loadingCharges || 0));
        setLoadingGst(ord.loadingGst !== undefined ? Boolean(ord.loadingGst) : true);
        setPackingCharges(String(ord.packingCharges || 0));
        setPackingGst(ord.packingGst !== undefined ? Boolean(ord.packingGst) : true);
        setOtherCharges(String(ord.otherCharges || 0));
        setOtherGst(ord.otherGst !== undefined ? Boolean(ord.otherGst) : true);
        setDiscountValue(String(ord.discountValue || 0));
        setDiscountType('Flat');

        let loadedItems = [];
        if (ord.items && ord.items.length > 0) {
          loadedItems = ord.items.map((it, idx) => ({
            id: it.id || idx + 1,
            productId: it.productId,
            productName: it.productName || it.product?.name || 'Item',
            code: it.product?.code || '',
            hsnCode: it.hsnCode || it.product?.hsnCode || '21050000',
            uomName: it.uomName || it.product?.unit?.abbreviation || 'pcs',
            quantity: Number(it.quantity || 1),
            unitPrice: Number(it.unitPrice || 0),
            discount: Number(it.discount || 0),
            gstRate: Number(it.gstRate || 18),
            batchId: it.batchId || null,
            batchNo: it.batchNo || '',
            expiryDate: it.expiryDate || null,
            availableStock: it.product?.currentStock || 0
          }));
          setItems(loadedItems);
        }

        const snap = JSON.stringify({
          customerId: ord.customerId || '',
          taxRegNo: ord.taxRegNo || ord.customer?.gstin || '',
          deliveryAddress: ord.deliveryAddress || '',
          paymentTerms: ord.paymentTerms || '',
          freight: String(Number(ord.freight || 0)),
          loadingCharges: String(Number(ord.loadingCharges || 0)),
          packingCharges: String(Number(ord.packingCharges || 0)),
          otherCharges: String(Number(ord.otherCharges || 0)),
          discountValue: String(Number(ord.discountValue || 0)),
          deliveryDate: ord.deliveryDate ? ord.deliveryDate.split('T')[0] : '',
          items: loadedItems.map(it => ({
            productId: it.productId,
            quantity: Number(it.quantity || 1),
            unitPrice: Number(it.unitPrice || 0),
            discount: Number(it.discount || 0)
          })).sort((a, b) => (a.productId || '').localeCompare(b.productId || ''))
        });
        setInitialSnapshot(snap);
      }).catch(err => console.error('Failed to pre-fetch edit order:', err));
      return;
    }

    const mode = searchParams.get('mode');
    if (mode === 'quotation') setOrderType('Quotation');
    else if (mode === 'sales-order' || mode === 'order') setOrderType('Sales Order');
    else if (mode === 'invoice') setOrderType('Invoice');
    else if (mode === 'pos') setOrderType('POS');

    const sourceOrderId = searchParams.get('sourceId') || searchParams.get('convertFrom');
    if (sourceOrderId) {
      api.get(`/orders/${sourceOrderId}/details`).then(res => {
        if (res.data) handleLoadConvertedOrder(res.data);
      }).catch(err => console.error('Failed to pre-fetch source order:', err));
    }
  }, [searchParams, editOrderId]);

  // Fetch Customers List
  const { data: customers = [], refetch: refetchCustomers } = useQuery({
    queryKey: ['customers-billing-list'],
    queryFn: () => api.get('/parties/customers').then(r => r.data || []),
  });

  // Fetch Products with Auto-FEFO Expiring Batches
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products-search-list'],
    queryFn: () => api.get('/products/search', { params: { limit: 500 } }).then(r => r.data || []),
  });

  // Fetch Company Details & Tax Config
  const { data: companyDetails = {} } = useQuery({
    queryKey: ['company-details'],
    queryFn: () => api.get('/setup/tax').then(r => r.data || {}),
  });

  // Resolve Seller State
  const sellerStateCode = companyDetails.stateCode || (companyDetails.companyGstin ? companyDetails.companyGstin.substring(0, 2) : '33');
  const sellerStateObj = indianStates.find(s => s.code === String(sellerStateCode)) || { code: '33', name: 'Tamil Nadu' };

  // Sync default place of supply when company details load
  useEffect(() => {
    if (sellerStateCode && !taxRegNo) {
      setPlaceOfSupply(sellerStateCode);
    }
  }, [sellerStateCode]);

  // Categories list
  const categories = ['All', ...new Set(products.map(p => p.category?.name || p.category).filter(Boolean))];

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const pCat = p.category?.name || p.category || '';
    const matchCategory = selectedCategory === 'All' || pCat === selectedCategory;
    const matchSearch = !searchQuery.trim() ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.hsnCode && p.hsnCode.includes(searchQuery));
    return matchCategory && matchSearch;
  });

  // Handle Customer Selection & Auto GSTIN State Resolution
  const handleSelectCustomer = (cId) => {
    setCustomerId(cId);
    const found = customers.find(c => c.id === cId);
    setSelectedCustomer(found || null);
    if (found) {
      if (found.gstin) {
        const cleanGst = found.gstin.trim().toUpperCase();
        setTaxRegNo(cleanGst);
        const derivedStateCode = getStateCodeFromGstin(cleanGst) || (cleanGst.length >= 2 ? cleanGst.substring(0, 2) : null);
        if (derivedStateCode && indianStates.some(s => s.code === derivedStateCode)) {
          setPlaceOfSupply(derivedStateCode);
        }
      }
      if (found.address) setDeliveryAddress(found.address);
    }
  };

  // Handle GSTIN manual edit & auto state update
  const handleGstinInputChange = (e) => {
    const val = e.target.value.toUpperCase();
    setTaxRegNo(val);
    const derivedCode = getStateCodeFromGstin(val) || (val.length >= 2 ? val.substring(0, 2) : null);
    if (derivedCode && indianStates.some(s => s.code === derivedCode)) {
      setPlaceOfSupply(derivedCode);
    }
  };

  // Convert source order
  const handleLoadConvertedOrder = (order) => {
    if (!order) return;
    setCustomerId(order.customerId || '');
    const found = customers.find(c => c.id === order.customerId);
    setSelectedCustomer(found || order.customer || null);
    if (order.customer?.gstin || order.taxRegNo) {
      const g = order.customer?.gstin || order.taxRegNo;
      setTaxRegNo(g);
      const code = getStateCodeFromGstin(g) || (g.length >= 2 ? g.substring(0, 2) : null);
      if (code && indianStates.some(s => s.code === code)) {
        setPlaceOfSupply(code);
      }
    }
    if (order.deliveryAddress) setDeliveryAddress(order.deliveryAddress);
    if (order.paymentTerms) setPaymentTerms(order.paymentTerms);
    if (order.freight) setFreight(String(order.freight));
    if (order.loadingCharges) setLoadingCharges(String(order.loadingCharges));
    if (order.packingCharges) setPackingCharges(String(order.packingCharges));

    if (order.items && order.items.length > 0) {
      setItems(order.items.map((it, idx) => ({
        id: it.id || idx + 1,
        productId: it.productId,
        productName: it.productName || it.product?.name || 'Item',
        code: it.product?.code || '',
        hsnCode: it.hsnCode || it.product?.hsnCode || '21050000',
        uomName: it.uomName || it.product?.unit?.abbreviation || 'pcs',
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || 0),
        discount: Number(it.discount || 0),
        gstRate: Number(it.gstRate || 18),
        batchId: it.batchId || null,
        batchNo: it.batchNo || '',
        expiryDate: it.expiryDate || null,
        availableStock: it.product?.currentStock || 0
      })));
    }
  };

  // Add Product to Selected Item Lines (Auto-FEFO Batch Allocation)
  const handleAddProduct = (prod) => {
    setItems(prev => {
      const existingIdx = prev.findIndex(item => item.productId === prod.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }

      // Auto-assign earliest expiring batch (Auto-FEFO)
      const nextBatch = prod.nextExpiringBatch;
      return [
        ...prev,
        {
          id: Date.now() + Math.random(),
          productId: prod.id,
          productName: prod.name,
          code: prod.code,
          hsnCode: prod.hsnCode || '21050000',
          uomName: prod.unit?.abbreviation || prod.unit?.name || prod.unit || 'pcs',
          quantity: 1,
          unitPrice: Number(prod.salePrice || 0),
          discount: 0,
          gstRate: Number(prod.gstRate !== undefined && prod.gstRate !== null ? prod.gstRate : selectedGstRate),
          batchId: nextBatch ? nextBatch.batchId : null,
          batchNo: nextBatch ? nextBatch.batchNo : '',
          expiryDate: nextBatch ? nextBatch.expiryDate : null,
          availableStock: prod.currentStock || 0
        }
      ];
    });
  };

  // Global GST Rate Change (0, 5, 12, 18, 28)
  const handleGlobalGstRateChange = (rate) => {
    setSelectedGstRate(rate);
    setItems(prev => prev.map(item => ({ ...item, gstRate: rate })));
  };

  // Item Change handler
  const handleItemChange = (idx, field, val) => {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  // Remove Item
  const handleRemoveItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // -------------------------------------------------------------
  // INTELLIGENT TAX CALCULATION WITH GSTIN AUTO + MANUAL OVERRIDE
  // -------------------------------------------------------------
  const customerGstin = (taxRegNo || selectedCustomer?.gstin || '').trim();
  const customerStateCode = getStateCodeFromGstin(customerGstin);
  const hasCustomerGstin = Boolean(customerStateCode);

  const buyerStateCode = placeOfSupply || customerStateCode || sellerStateCode;
  const buyerStateObj = indianStates.find(s => s.code === String(buyerStateCode)) || { code: buyerStateCode, name: 'State ' + buyerStateCode };

  let isInterState = false;
  if (hasCustomerGstin) {
    // Strictly auto-applied & locked when GSTIN is available
    isInterState = String(sellerStateCode) !== String(customerStateCode);
  } else if (taxMode === 'INTRA') {
    isInterState = false;
  } else if (taxMode === 'INTER') {
    isInterState = true;
  } else {
    // 'AUTO' mode based on Seller State vs Buyer State
    isInterState = String(sellerStateCode) !== String(buyerStateCode);
  }

  // Raw Subtotal
  const rawSubtotal = items.reduce((sum, it) => {
    const rate = Number(it.unitPrice || 0);
    const disc = Number(it.discount || 0);
    const qty = Number(it.quantity || 0);
    return sum + ((rate - disc) * qty);
  }, 0);

  // Calculated Discount
  const discountNum = Number(discountValue || 0);
  const calculatedDiscount = discountType === 'Percent'
    ? (rawSubtotal * (discountNum / 100))
    : discountNum;

  const taxableSubtotal = Math.max(0, rawSubtotal - calculatedDiscount);

  // Additional Charges
  const freightNum = Number(freight || 0);
  const loadingNum = Number(loadingCharges || 0);
  const packingNum = Number(packingCharges || 0);
  const otherNum = Number(otherCharges || 0);

  // Line-by-Line Taxes
  let totalGstTax = 0;
  let cgstVal = 0;
  let sgstVal = 0;
  let igstVal = 0;

  if (collectTax) {
    items.forEach(it => {
      const lineTaxable = ((Number(it.unitPrice || 0) - Number(it.discount || 0)) * Number(it.quantity || 0));
      const ratio = rawSubtotal > 0 ? (lineTaxable / rawSubtotal) : 0;
      const discountedLine = Math.max(0, lineTaxable - (calculatedDiscount * ratio));
      const lineGstRate = Number(it.gstRate !== undefined ? it.gstRate : selectedGstRate);
      const lineTax = (discountedLine * lineGstRate) / 100;
      totalGstTax += lineTax;
    });

    // Charges GST
    const chargeGstRate = (selectedGstRate / 100);
    if (freightGst && freightNum > 0) totalGstTax += (freightNum * chargeGstRate);
    if (loadingGst && loadingNum > 0) totalGstTax += (loadingNum * chargeGstRate);
    if (packingGst && packingNum > 0) totalGstTax += (packingNum * chargeGstRate);
    if (otherGst && otherNum > 0) totalGstTax += (otherNum * chargeGstRate);

    if (isInterState) {
      igstVal = totalGstTax;
    } else {
      cgstVal = totalGstTax / 2;
      sgstVal = totalGstTax / 2;
    }
  }

  const unroundedTotal = taxableSubtotal + totalGstTax + freightNum + loadingNum + packingNum + otherNum;
  const grandTotal = Math.round(unroundedTotal);
  const roundOff = grandTotal - unroundedTotal;
  const grandTotalWords = numberToWordsINR(grandTotal);

  // Submit Order Mutation
  const createOrderMutation = useMutation({
    mutationFn: async (payload) => {
      if (editOrderId) {
        const res = await api.put(`/orders/${editOrderId}`, payload);
        return res.data;
      }
      let endpoint = '/orders/sales-order';
      if (orderType === 'Invoice') endpoint = '/orders/invoice';
      else if (orderType === 'Quotation') endpoint = '/orders/quotation';
      else if (orderType === 'POS') endpoint = '/orders/pos';

      const res = await api.post(endpoint, payload);
      return res.data;
    },
    onSuccess: (savedOrder) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-search-list'] });

      if (editOrderId) {
        Swal.fire({
          icon: 'success',
          title: 'Order Updated Successfully!',
          text: `Document Reference ${savedOrder.docNo || savedOrder.referenceNo || 'Updated'} saved to database.`,
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
        const fromUrl = searchParams.get('from') || '/orders/list';
        navigate(fromUrl);
        return;
      }

      setCompletedOrder({ ...savedOrder, items });

      // Generate both A4 and Thermal 80mm PDF Blobs
      const a4Blob = generateA4TaxInvoice(
        { ...savedOrder, items },
        companyDetails
      );
      const posBlob = generateThermalReceipt(
        { ...savedOrder, items },
        companyDetails
      );

      const a4Url = URL.createObjectURL(a4Blob);
      const posUrl = URL.createObjectURL(posBlob);

      setPdfPreviewUrlA4(a4Url);
      setPdfPreviewUrlPOS(posUrl);
      setPdfPreviewUrl(orderType === 'POS' ? posUrl : a4Url);
      setPreviewMode(orderType === 'POS' ? 'POS' : 'A4');
      setShowReceiptModal(true);

      Swal.fire({
        icon: 'success',
        title: `${orderType} Recorded Successfully!`,
        text: `Document Reference ${savedOrder.docNo || savedOrder.referenceNo || 'Created'} generated.`,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    },
    onError: (err) => {
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: err?.response?.data?.error || err.message,
        confirmButtonColor: '#4f46e5'
      });
    }
  });

  const handleSubmitOrder = () => {
    if (items.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Empty Order Lines', text: 'Please add products to the line items table.', timer: 2000 });
      return;
    }
    if (!customerId && orderType !== 'POS') {
      Swal.fire({ icon: 'warning', title: 'Customer Required', text: 'Please select a customer for this order.', timer: 2000 });
      return;
    }

    if (editOrderId && initialSnapshot) {
      const currentSnap = JSON.stringify({
        customerId: customerId || '',
        taxRegNo: taxRegNo || '',
        deliveryAddress: deliveryAddress || '',
        paymentTerms: paymentTerms || '',
        freight: String(Number(freight || 0)),
        loadingCharges: String(Number(loadingCharges || 0)),
        packingCharges: String(Number(packingCharges || 0)),
        otherCharges: String(Number(otherCharges || 0)),
        discountValue: String(Number(calculatedDiscount || 0)),
        deliveryDate: deliveryDate || '',
        items: items.map(it => ({
          productId: it.productId,
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || 0),
          discount: Number(it.discount || 0)
        })).sort((a, b) => (a.productId || '').localeCompare(b.productId || ''))
      });

      if (currentSnap === initialSnapshot) {
        Swal.fire({
          icon: 'info',
          title: 'Nothing Changed',
          text: 'No modifications were made to this order.',
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
        return;
      }
    }

    const payload = {
      customerId: customerId || undefined,
      customerName: selectedCustomer?.name || (orderType === 'POS' ? 'Walk-in Customer' : undefined),
      customerPhone: selectedCustomer?.phone || '',
      type: orderType,
      status: orderType === 'Quotation' ? 'Quotation' : (orderType === 'POS' ? 'Delivered' : 'Confirmed'),
      paymentTerms,
      deliveryDate: new Date(deliveryDate).toISOString(),
      createdAt: new Date(orderDate).toISOString(),
      deliveryAddress: deliveryAddress || selectedCustomer?.address || (orderType === 'POS' ? 'Counter POS Pickup' : 'Standard Delivery'),
      internalNote,
      transporterName: transporterName || undefined,
      vehicleNo: vehicleNo || undefined,
      lrNo: lrNo || undefined,
      collectTax,
      taxRegNo: taxRegNo || null,
      placeOfSupply,
      taxType: isInterState ? 'Inter-State' : 'Intra-State',
      taxMode,
      discountValue: calculatedDiscount,
      freight: freightNum,
      freightGst,
      loadingCharges: loadingNum,
      loadingGst,
      packingCharges: packingNum,
      packingGst,
      otherCharges: otherNum,
      otherGst,
      cgst: cgstVal,
      sgst: sgstVal,
      igst: igstVal,
      roundOff,
      grandTotal,
      counterId: orderType === 'POS' ? 'COUNTER-01' : undefined,
      items: items.map(it => ({
        productId: it.productId,
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || 0),
        discount: Number(it.discount || 0),
        gstRate: Number(it.gstRate || 18),
        hsnCode: it.hsnCode,
        uomName: it.uomName,
        batchId: it.batchId || null,
        batchNo: it.batchNo || null,
        expiryDate: it.expiryDate || null,
        deliveryDate: new Date(deliveryDate).toISOString()
      }))
    };

    createOrderMutation.mutate(payload);
  };

  const handlePrintCurrentPdf = () => {
    const iframe = document.getElementById('sales-billing-pdf-frame');
    if (iframe) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-5 py-3 space-y-3.5 mx-auto transition-all duration-300 text-slate-900 dark:text-slate-100">
      
      {/* Edit Mode Notification Banner */}
      {editOrderId && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-bold shadow-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Editing Order #{editingOrderDocNo || editOrderId}. Modify items, prices, or parameters and click "Update Order".</span>
          </div>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate(searchParams.get('from') || '/orders/list')}
            className="h-8 text-xs font-bold rounded-xl border-amber-500/40 hover:bg-amber-500/10 cursor-pointer text-amber-900 dark:text-amber-200"
          >
            Cancel & Back to Orders
          </Button>
        </div>
      )}

      {/* 1. TOP EXECUTIVE HEADER BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-3 sm:p-4 rounded-2xl flex flex-wrap justify-between items-center gap-3 shadow-xs dark:shadow-xl transition-all">
        <div className="flex items-center space-x-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(searchParams.get('from') || '/orders/list')}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer h-9 w-9 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Walk-in POS Counter
              </h1>
              <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-black border border-emerald-200 dark:border-emerald-800 uppercase tracking-wide">
                Live POS Counter
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Intelligent GST Engine • Seller: {sellerStateObj.name} ({sellerStateObj.code}) • Auto Intra/Inter State Detection
            </p>
          </div>
        </div>

        {/* Live Order Metric Summary Pill Bar */}
        <div className="hidden lg:flex items-center gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 rounded-xl text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Party:</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200 line-clamp-1 max-w-[120px]">
              {selectedCustomer?.name || (orderType === 'POS' ? 'Walk-in Cash' : 'Select Customer')}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Cart:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{items.length} lines</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Total:</span>
            <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">₹{grandTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* 2. MAIN TWO-COLUMN WORKFLOW DESK (Left 7 Cols: Catalog & FEFO Stock, Right 5 Cols: Setup & Charges) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* LEFT 7 COLUMNS: Finished Product Catalog & FEFO Stock Grid */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs dark:shadow-xl">
            <div className="py-3 px-4 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-500" /> Finished Product Catalog
              </h3>
              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-2.5 py-0.5 rounded-full font-black border border-indigo-100 dark:border-indigo-900">
                {filteredProducts.length} Items Available
              </span>
            </div>

            <div className="p-3.5 space-y-3">
              {/* Product Search & Dropdown Input */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <Input
                  placeholder="Search product by name, code (e.g. FP-000006), or HSN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-indigo-500"
                />
              </div>

              {/* Category Filter Chips */}
              <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-xl text-3xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Product Cards Grid with Auto-FEFO Batch & Expiry Display */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-[620px] overflow-y-auto pr-1">
                {loadingProducts ? (
                  <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading product catalog & FEFO stock...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400 text-xs italic">
                    No products matched your search.
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const nextBatch = p.nextExpiringBatch;
                    const hasBatch = Boolean(nextBatch && nextBatch.batchNo);
                    const isExpDate = nextBatch?.expiryDate ? new Date(nextBatch.expiryDate).toLocaleDateString('en-GB') : null;

                    return (
                      <div
                        key={p.id}
                        onClick={() => handleAddProduct(p)}
                        className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-xl p-3 cursor-pointer transition-all shadow-2xs hover:shadow-md flex flex-col justify-between group active:scale-[0.99]"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                            <span className="font-bold">{p.code}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.2 rounded font-bold ${
                                (p.currentStock || 0) > 10
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                              }`}>
                                Stock: {p.currentStock || 0}
                              </span>
                              <button
                                type="button"
                                title="Inspect Stock & BOM Details"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStockQueryProductId(p.id);
                                  setIsStockQueryOpen(true);
                                }}
                                className="p-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {p.name}
                          </h4>

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
                              <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.2 rounded text-[9px] font-mono">
                                📦 Direct Stock
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-baseline justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/80 mt-2">
                          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">
                            ₹{Number(p.salePrice || 0).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            +{p.gstRate || 18}% GST
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT 5 COLUMNS: Customer & Order Setup, Cart Lines & Charges Ledger */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Card 1: Customer & Order Setup */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-xl rounded-2xl overflow-visible">
            <div className="py-2.5 px-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-indigo-500" /> Customer & Order Setup
              </h3>
              {selectedCustomer && (
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                  selectedCustomer.customerType === 'B2B' 
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' 
                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {selectedCustomer.customerType || 'B2B'}
                </span>
              )}
            </div>

            <div className="p-3.5 space-y-3 text-xs">
              
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Customer Name *</label>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddModal(true)}
                    className="text-3xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
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
                  placeholder="Select Customer..."
                  searchPlaceholder="Search by name / phone / GSTIN / B2B..."
                  required
                  triggerClassName="h-9 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Order Mode</label>
                  <div className="h-9 px-3 flex items-center bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Walk-in POS
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Payment Terms</label>
                  <SearchSelect
                    value={paymentTerms}
                    onChange={setPaymentTerms}
                    options={[
                      { value: 'Not Paid', label: 'Not Paid' },
                      { value: 'Paid', label: 'Paid' },
                      { value: 'Advance Payment', label: 'Advance Payment' },
                      { value: 'Net 30', label: 'Net 30' },
                      { value: 'Cash', label: 'Cash' },
                      { value: 'UPI', label: 'UPI' },
                      { value: 'Card', label: 'Card' }
                    ]}
                    showSearch={false}
                    placeholder="Payment Option..."
                    required
                    triggerClassName={`h-9 text-xs font-bold border rounded-xl transition-all ${
                      paymentTerms === 'Paid' || paymentTerms === 'Cash' || paymentTerms === 'UPI' || paymentTerms === 'Card'
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
                        : paymentTerms === 'Advance Payment'
                        ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
                        : 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
                    }`}
                  />
                </div>
              </div>

              {/* Order Timestamp & Delivery Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Order Timestamp</label>
                    <button
                      type="button"
                      onClick={() => setIsClockRunning(!isClockRunning)}
                      className={`text-[8px] px-1.5 py-0.5 rounded font-black transition-all ${
                        isClockRunning 
                          ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 animate-pulse' 
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-500'
                      }`}
                    >
                      {isClockRunning ? 'LIVE' : 'FREEZE'}
                    </button>
                  </div>
                  {/* Digital Clock Display */}
                  <div className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      {formatLiveDateTime(orderDate)}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">LIVE</span>
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
                    triggerClassName="h-8.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white w-full"
                  />
                </div>

                <DatePicker
                  label="Delivery Date *"
                  required
                  value={deliveryDate ? new Date(deliveryDate) : null}
                  onChange={(date) => setDeliveryDate(date ? date.toISOString().split('T')[0] : '')}
                  modalTitle="Select Delivery Date"
                  placeholder="Select date"
                  className="space-y-1"
                  labelClassName="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase"
                  triggerClassName="h-9 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white w-full rounded-xl"
                />
              </div>

              {/* GST Number, Place of Supply & 1-Click CGST vs IGST Switcher */}
              <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                    GST Treatment Mode
                  </label>
                  {taxMode !== 'AUTO' && (
                    <button
                      type="button"
                      onClick={() => setTaxMode('AUTO')}
                      className="text-[9px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      Reset to Auto-Detect
                    </button>
                  )}
                </div>

                {hasCustomerGstin ? (
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-500 font-bold text-xs">🔒</span>
                      <span className={`text-xs font-black ${isInterState ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {isInterState ? '🌐 INTER-STATE (IGST)' : '🏛️ INTRA-STATE (CGST + SGST)'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">Auto-Applied via GSTIN (Locked)</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setTaxMode('INTRA')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        !isInterState
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>🏛️ Intra-State</span>
                      <span className="text-[9px] opacity-80">(CGST+SGST)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxMode('INTER')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        isInterState
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>🌐 Inter-State</span>
                      <span className="text-[9px] opacity-80">(IGST)</span>
                    </button>
                  </div>
                )}

                {/* Customer GSTIN & Place of Supply State Inputs */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Customer GSTIN</label>
                    <Input
                      placeholder="e.g. 33AAAAA0000A1Z5"
                      value={taxRegNo}
                      onChange={handleGstinInputChange}
                      className="h-9 text-xs font-mono font-bold uppercase tracking-wider bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Place of Supply State</label>
                    <select
                      value={placeOfSupply}
                      onChange={(e) => setPlaceOfSupply(e.target.value)}
                      className="w-full h-9 text-xs font-semibold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 text-slate-900 dark:text-white focus:outline-indigo-500 cursor-pointer"
                    >
                      {indianStates.map(state => (
                        <option key={state.code} value={state.code}>
                          {state.code} - {state.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* State Identification Status Badge */}
                <div className={`p-2 rounded-xl border flex items-center justify-between text-[11px] ${
                  isInterState
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                }`}>
                  <span className="font-extrabold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    {isInterState ? 'Inter-State Supply (IGST Applied)' : 'Intra-State Supply (CGST + SGST Applied)'}
                  </span>
                  <span className="font-mono text-[10px] opacity-80">
                    {sellerStateObj.name} ({sellerStateObj.code}) → {buyerStateObj.name} ({buyerStateObj.code})
                  </span>
                </div>
              </div>

              {/* Shipping Destination Address */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Shipping Address</label>
                <Input
                  placeholder="Destination address..."
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="h-9 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Optional Transporter Info */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Transporter Name</label>
                  <Input
                    placeholder="Agency / Carrier..."
                    value={transporterName}
                    onChange={(e) => setTransporterName(e.target.value)}
                    className="h-8.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Vehicle / LR No</label>
                  <Input
                    placeholder="TN-XX-XXXX / LR-XXX"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                    className="h-8.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Selected Order Items Cart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-visible shadow-xs dark:shadow-xl">
            <div className="py-2.5 px-4 border-b border-slate-100 dark:border-slate-800 flex flex-row justify-between items-center">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-indigo-500" /> Selected Item Lines
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded-full font-black text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                  {items.length} Lines
                </span>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setItems([])}
                    className="text-slate-400 hover:text-rose-500 cursor-pointer p-0.5"
                    title="Clear All Lines"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-3 space-y-3">
              {items.length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500 italic text-xs border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/40">
                  Click products from the catalog to add items here.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {items.map((item, idx) => {
                    const lineSubtotal = (Number(item.unitPrice || 0) - Number(item.discount || 0)) * Number(item.quantity || 1);
                    const rate = Number(item.gstRate !== undefined ? item.gstRate : selectedGstRate);
                    const lineTaxVal = (lineSubtotal * rate) / 100;

                    return (
                      <div key={item.id || idx} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-black text-[10px] shrink-0">
                              {idx + 1}
                            </span>
                            <div className="truncate flex-1">
                              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                                {item.productName} <span className="text-[9px] text-slate-400 font-mono">({item.code})</span>
                              </h4>
                              {/* FEFO Batch Badge */}
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
                              title="Inspect Stock & BOM Query"
                              onClick={() => {
                                setStockQueryProductId(item.productId);
                                setIsStockQueryOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 p-1 cursor-pointer shrink-0"
                            onClick={() => handleRemoveItem(idx)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 items-end">
                          <div className="space-y-0.5">
                            <label className="text-[8px] font-bold text-slate-400 uppercase block">Qty</label>
                            <QuantitySelector
                              value={item.quantity}
                              onChange={(val) => handleItemChange(idx, 'quantity', val)}
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[8px] font-bold text-slate-400 uppercase block">Price (₹)</label>
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
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
                              onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                              className="font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-8 rounded-xl text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-900 text-[10px] font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">GST:</span>
                            <select
                              value={item.gstRate !== undefined ? item.gstRate : selectedGstRate}
                              onChange={(e) => handleItemChange(idx, 'gstRate', Number(e.target.value))}
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                            >
                              {gstRateOptions.map(r => (
                                <option key={r} value={r}>{r}%</option>
                              ))}
                            </select>
                            <span className="text-[9px] text-slate-400">
                              ({isInterState ? `IGST: ₹${lineTaxVal.toFixed(2)}` : `C+S: ₹${lineTaxVal.toFixed(2)}`})
                            </span>
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
          </div>

          {/* Card 3: Charges & Tax Ledger */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-xl rounded-2xl overflow-hidden">
            <div className="py-2.5 px-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-emerald-500" /> Charges & Tax Ledger
              </h3>
              <label className="flex items-center gap-1 text-3xs font-extrabold cursor-pointer text-slate-700 dark:text-slate-300">
                <input 
                  type="checkbox" 
                  checked={collectTax} 
                  onChange={() => setCollectTax(!collectTax)}
                  className="rounded border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 accent-indigo-600 w-3.5 h-3.5"
                />
                GST {collectTax ? 'ON' : 'OFF'}
              </label>
            </div>
            
            <div className="p-3.5 space-y-3 text-xs">
              
              {/* GST Rate Slabs Selector: 0%, 5%, 12%, 18%, 28% */}
              {collectTax && (
                <div className="flex items-center justify-between gap-2 pt-0.5 pb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">GST Rate:</span>
                  <div className="flex items-center gap-1 overflow-x-auto bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    {gstRateOptions.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handleGlobalGstRateChange(rate)}
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          selectedGstRate === rate
                            ? 'bg-indigo-600 text-white shadow-xs scale-105'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Discount input row with ₹ / % toggle */}
              <div className="flex gap-2 items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Discount:</span>
                <div className="flex bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDiscountType('Flat')}
                    className={`px-2 py-0.5 text-3xs font-extrabold rounded cursor-pointer ${discountType === 'Flat' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
                  >
                    ₹
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('Percent')}
                    className={`px-2 py-0.5 text-3xs font-extrabold rounded cursor-pointer ${discountType === 'Percent' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
                  >
                    %
                  </button>
                </div>
                <Input
                  type="number"
                  min="0"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white h-8 text-xs font-mono font-bold"
                />
              </div>

              {/* Additional charges grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                    <span>Freight (₹)</span>
                    <label className="cursor-pointer flex items-center gap-0.5">
                      <input type="checkbox" checked={freightGst} onChange={() => setFreightGst(!freightGst)} className="w-2.5 h-2.5 accent-indigo-600" /> GST
                    </label>
                  </div>
                  <Input type="number" min="0" value={freight} onChange={(e) => setFreight(e.target.value)} className="h-7.5 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                    <span>Loading (₹)</span>
                    <label className="cursor-pointer flex items-center gap-0.5">
                      <input type="checkbox" checked={loadingGst} onChange={() => setLoadingGst(!loadingGst)} className="w-2.5 h-2.5 accent-indigo-600" /> GST
                    </label>
                  </div>
                  <Input type="number" min="0" value={loadingCharges} onChange={(e) => setLoadingCharges(e.target.value)} className="h-7.5 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                    <span>Packing (₹)</span>
                    <label className="cursor-pointer flex items-center gap-0.5">
                      <input type="checkbox" checked={packingGst} onChange={() => setPackingGst(!packingGst)} className="w-2.5 h-2.5 accent-indigo-600" /> GST
                    </label>
                  </div>
                  <Input type="number" min="0" value={packingCharges} onChange={(e) => setPackingCharges(e.target.value)} className="h-7.5 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                    <span>Other (₹)</span>
                    <label className="cursor-pointer flex items-center gap-0.5">
                      <input type="checkbox" checked={otherGst} onChange={() => setOtherGst(!otherGst)} className="w-2.5 h-2.5 accent-indigo-600" /> GST
                    </label>
                  </div>
                  <Input type="number" min="0" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} className="h-7.5 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono" />
                </div>
              </div>

              {/* Calculation Ledger Lines */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs font-semibold">
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
                  <div className="space-y-0.5 border-t border-slate-200/60 dark:border-slate-800/80 pt-1.5">
                    <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-bold">
                      <span>GST Tax ({isInterState ? `IGST ${selectedGstRate}%` : `CGST+SGST ${selectedGstRate}%`}):</span>
                      <span className="font-mono">₹{totalGstTax.toFixed(2)}</span>
                    </div>
                    {isInterState ? (
                      <div className="flex justify-between text-purple-600 dark:text-purple-400 pl-2 text-[11px]">
                        <span>• IGST (@{selectedGstRate}%):</span>
                        <span className="font-mono font-bold">₹{igstVal.toFixed(2)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-slate-500 dark:text-slate-400 pl-2 text-[11px]">
                          <span>• CGST (@{selectedGstRate / 2}%):</span>
                          <span className="font-mono font-bold">₹{cgstVal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 dark:text-slate-400 pl-2 text-[11px]">
                          <span>• SGST (@{selectedGstRate / 2}%):</span>
                          <span className="font-mono font-bold">₹{sgstVal.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {Math.abs(roundOff) > 0.001 && (
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Round Off:</span>
                    <span className="font-mono">{roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-indigo-600 dark:text-indigo-400 border-t border-slate-200 dark:border-slate-800 pt-1.5">
                  <span>Grand Total:</span>
                  <span className="font-mono text-base text-indigo-600 dark:text-indigo-400">₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-[10px] text-slate-400 italic line-clamp-1">
                  {grandTotalWords}
                </p>
              </div>

              {/* Prominent Submit Action Button */}
              <Button
                type="button"
                onClick={handleSubmitOrder}
                disabled={createOrderMutation.isPending || items.length === 0}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black py-3 h-12 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center text-xs gap-2 border border-indigo-500/50"
              >
                {createOrderMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {createOrderMutation.isPending 
                  ? (editOrderId ? 'Updating Order...' : 'Submitting Order Specs...') 
                  : editOrderId
                  ? 'Update Order'
                  : orderType === 'POS'
                  ? 'Complete POS Sale & Print'
                  : `Create ${orderType} & Print Receipt`
                }
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

      {/* Stock Query Explorer Modal */}
      {isStockQueryOpen && stockQueryProductId && (
        <ProductStockQueryModal
          productId={stockQueryProductId}
          isOpen={isStockQueryOpen}
          onClose={() => setIsStockQueryOpen(false)}
          allProducts={products}
          onSelectProduct={(pId) => setStockQueryProductId(pId)}
        />
      )}

      {/* Printable Receipt & Vector Invoice Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate__animated animate__fadeIn">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[88vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    {previewMode === 'POS' ? '80mm POS Slip Receipt' : 'A4 Tax Invoice Receipt'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Ref: {completedOrder?.docNo || completedOrder?.referenceNo}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewMode('A4');
                      setPdfPreviewUrl(pdfPreviewUrlA4);
                    }}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      previewMode === 'A4' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    A4 Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewMode('POS');
                      setPdfPreviewUrl(pdfPreviewUrlPOS);
                    }}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      previewMode === 'POS' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    80mm Thermal
                  </button>
                </div>

                <Button
                  onClick={handlePrintCurrentPdf}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3 rounded-lg"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" /> Print
                </Button>

                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 p-4 overflow-hidden relative">
              {pdfPreviewUrl ? (
                <iframe
                  id="sales-billing-pdf-frame"
                  src={pdfPreviewUrl}
                  className="w-full h-full border-none rounded-xl"
                  title="Sales Invoice Frame"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                  Generating vector receipt...
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReceiptModal(false);
                  navigate('/sales/orders');
                }}
                className="text-xs border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl h-8 px-4"
              >
                Close & View Sales Log
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
