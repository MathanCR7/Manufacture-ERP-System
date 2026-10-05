import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/axios';
import {
  FileText, Plus, Trash2, Printer, Check, X,
  AlertTriangle, ArrowRight, Building2, Calendar, Truck, DollarSign, Percent,
  ChevronDown, ChevronUp, RefreshCw, Search, ArrowLeft, ShieldAlert,
  Sparkles, Layers, Receipt, Clock, CheckCircle2, Download, Tag, UserPlus, Eye,
  Package, CreditCard, Banknote, HelpCircle, ShieldCheck, Info,
  SlidersHorizontal, CheckSquare, Square, MapPin, Globe, Moon, Sun,
  ExternalLink, ChevronRight, Minimize2, Maximize2, LayoutGrid, Table
} from 'lucide-react';
import SearchSelect from '@/components/ui/SearchSelect';
import QuickAddCustomerModal from '@/components/forms/QuickAddCustomerModal';
import ProductStockQueryModal from '@/modules/production/components/ProductStockQueryModal';
import { calculateGST, numberToWordsINR, getIndianStates, getStateCodeFromGstin } from '@/utils/gstEngine';
import { generateA4TaxInvoice } from '@/utils/salesPdfGenerator';
import useAuthStore from '@/app/store/authStore';
import useCompanyStore from '@/app/store/companyStore';
import Swal from 'sweetalert2';

// SAP B1 Style Color Variables & Full-Screen Inline Styles
const sapStyles = `
  .sap-doc-container {
    --sap-bg-window: #f2f5f8;
    --sap-border-outer: #8fa0b0;
    --sap-border-inner: #b0bfc9;
    --sap-text: #1a2228;
    --sap-text-muted: #536270;
    --sap-input-bg: #ffffff;
    --sap-input-readonly: #e5ebf0;
    --sap-header-bg: #e2e8ee;
    --sap-btn-gold: #f0b429;
    --sap-btn-gold-hover: #e0a41f;
    --sap-btn-gold-text: #1a2228;
    --sap-btn-sec: #e5ebf0;
    --sap-btn-sec-hover: #d7e0e7;
    --sap-tab-active-bg: #f2f5f8;
    --sap-tab-inactive-bg: #dfe5ec;
    --sap-grid-alt: #f8fafc;
    --sap-titlebar: #334155;
    --sap-titlebar-text: #ffffff;
    --sap-status-bar: #334155;
    --sap-drilldown: #ea580c;
  }

  .dark .sap-doc-container {
    --sap-bg-window: #1e293b;
    --sap-border-outer: #334155;
    --sap-border-inner: #475569;
    --sap-text: #f1f5f9;
    --sap-text-muted: #94a3b8;
    --sap-input-bg: #0f172a;
    --sap-input-readonly: #1e293b;
    --sap-header-bg: #334155;
    --sap-btn-gold: #f0b429;
    --sap-btn-gold-hover: #e0a41f;
    --sap-btn-gold-text: #1a2228;
    --sap-btn-sec: #334155;
    --sap-btn-sec-hover: #475569;
    --sap-tab-active-bg: #1e293b;
    --sap-tab-inactive-bg: #0f172a;
    --sap-grid-alt: #182234;
    --sap-titlebar: #0f172a;
    --sap-titlebar-text: #f8fafc;
    --sap-status-bar: #0f172a;
    --sap-drilldown: #fb923c;
  }
`;

// Helper: Format Date to DD/MM/YYYY
const formatDateDMY = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Helper: Parse DD/MM/YYYY to YYYY-MM-DD
const parseDMYtoYMD = (str) => {
  if (!str) return '';
  if (str.includes('-')) return str;
  const parts = str.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return str;
};

// Product Attribute Extractors
const getProductSystemCode = (p) => p?.systemCode || p?.code || 'NO-CODE';
const getProductName = (p) => p?.productName || p?.name || 'Unnamed Product';
const getProductCategory = (p) => p?.category || p?.specifications?.group || 'General';
const getProductBaseCategory = (p) => p?.baseCategory || p?.specifications?.category || p?.specifications?.group || p?.category || 'General';
const getProductSubcategory = (p) => p?.subcategory || p?.specifications?.series || p?.specifications?.category || '-';
const getProductUnitOfSale = (p) => p?.unitOfSale || p?.unit || p?.specifications?.sizeML || p?.size || 'pcs';
const getProductSalePrice = (p) => Number(p?.salePrice !== undefined ? p.salePrice : (p?.price || 0));

// Create empty document line
const createEmptyLine = (index = 1) => ({
  id: `line_${Date.now()}_${Math.random()}`,
  rowNo: index,
  productId: '',
  systemCode: '',
  itemDescription: '',
  category: '',
  baseCategory: '',
  subcategory: '',
  unitOfSale: 'pcs',
  quantity: 1,
  unitPrice: 0,
  discountPercent: 0,
  taxCode: 'SCG5',
  gstRate: 5,
  distrRule: 'Main FG Warehouse',
  stock: 0,
  rawProduct: null
});

export default function SalesOrderPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore(s => s.user);
  const storeCompany = useCompanyStore(s => s.company);
  const queryClient = useQueryClient();

  // Active Tab: 'contents' | 'logistics' | 'accounting' | 'tax' | 'attachments'
  const [activeTab, setActiveTab] = useState('contents');

  // Customer & Header Details
  const [customerId, setCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerRefNo, setCustomerRefNo] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [contactPerson, setContactPerson] = useState('');
  const [shipToAddress, setShipToAddress] = useState('');
  const [billToAddress, setBillToAddress] = useState('');

  // Right Header Fields
  const [docSeries, setDocSeries] = useState('Primary');
  const [docNo, setDocNo] = useState('');
  const [docStatus, setDocStatus] = useState('Open');
  const [postingDate, setPostingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const tm = new Date();
    tm.setDate(tm.getDate() + 1);
    return tm.toISOString().split('T')[0];
  });
  const [documentDate, setDocumentDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Item/Service Type
  const [itemServiceType, setItemServiceType] = useState('Item');

  // Document Lines (Start with 5 lines ready just like SAP B1)
  const [lines, setLines] = useState(() => [
    createEmptyLine(1),
    createEmptyLine(2),
    createEmptyLine(3),
    createEmptyLine(4),
    createEmptyLine(5)
  ]);

  // Bottom Section Fields
  const [salesEmployee, setSalesEmployee] = useState('-No Sales Employee-');
  const [owner, setOwner] = useState(currentUser?.name || 'Administrator');
  const [remarks, setRemarks] = useState('');

  // Discount & Rounding
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isRoundingEnabled, setIsRoundingEnabled] = useState(true);

  // Additional Charges & Tax Ledger
  const [freight, setFreight] = useState(0);
  const [freightGst, setFreightGst] = useState(true);
  const [loadingCharges, setLoadingCharges] = useState(0);
  const [loadingGst, setLoadingGst] = useState(true);
  const [packingCharges, setPackingCharges] = useState(0);
  const [packingGst, setLoadingPackingGst] = useState(true);
  const [otherCharges, setOtherCharges] = useState(0);
  const [otherGst, setOtherGst] = useState(true);

  // Logistics Tab Fields
  const [shippingMethod, setShippingMethod] = useState('Road Transport');
  const [transporterName, setTransporterName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [lrNo, setLrNo] = useState('');
  const [ewayBillNo, setEwayBillNo] = useState('');

  // Accounting Tab Fields
  const [paymentTerms, setPaymentTerms] = useState('Not Paid');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer / NEFT');
  const [advancePaid, setAdvancePaid] = useState(0);

  // Tax Tab Fields
  const [taxRegNo, setTaxRegNo] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('33'); // Default Tamil Nadu (33)

  // Status message bar (red error or green notification)
  const [statusMessage, setStatusMessage] = useState({
    type: 'ready',
    text: '✔ Document Ready - Ready to enter Sales Order'
  });

  // Modal States
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogViewMode, setCatalogViewMode] = useState('table'); // 'table' | 'cards'
  const [stockQueryProductId, setStockQueryProductId] = useState(null);
  const [isStockQueryOpen, setIsStockQueryOpen] = useState(false);
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('All');

  // Prominent Top Quick Product Search Bar State
  const [topSearchText, setTopSearchText] = useState('');
  const [isTopSearchOpen, setIsTopSearchOpen] = useState(false);
  const searchContainerRef = useRef(null);

  // Inline Autocomplete active line state
  const [activeLookupLineId, setActiveLookupLineId] = useState(null);
  const [inlineSearchText, setInlineSearchText] = useState('');

  // 1. Fetch Customers
  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const res = await api.get('/parties/customers');
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
    staleTime: 60000
  });

  // 2. Fetch Finished Products (207 items)
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products-catalog-sap'],
    queryFn: async () => {
      const res = await api.get('/products/search?limit=1000');
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
    staleTime: 60000
  });

  // 3. Fetch Master Data (Users/Staff for Sales Employee dropdown)
  const { data: mastersData } = useQuery({
    queryKey: ['products-masters'],
    queryFn: async () => {
      const res = await api.get('/products/masters');
      return res.data || {};
    },
    staleTime: 300000
  });

  // 4. Fetch Order Count for Document Number
  const { data: ordersData } = useQuery({
    queryKey: ['orders-count'],
    queryFn: async () => {
      const res = await api.get('/orders?limit=10');
      return res.data || {};
    },
    staleTime: 60000
  });

  // Initialize Next Document Number
  useEffect(() => {
    if (!docNo) {
      const count = ordersData?.total || (Array.isArray(ordersData?.data) ? ordersData.data.length : 0);
      const nextNum = 100100000 + count + 1;
      setDocNo(String(nextNum));
    }
  }, [ordersData, docNo]);

  // Click outside to close top search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsTopSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Extract Categories from 207 products
  const productCategories = useMemo(() => {
    const set = new Set();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [products]);

  // Handle Customer Selection
  const handleCustomerChange = (cid) => {
    setCustomerId(cid);
    const cust = customers.find(c => c.id === cid);
    if (cust) {
      setSelectedCustomer(cust);
      setContactPerson(cust.contactPerson || cust.phone || '');
      setShipToAddress(cust.shippingAddress || cust.address || '');
      setBillToAddress(cust.billingAddress || cust.address || '');
      setTaxRegNo(cust.gstin || '');
      if (cust.paymentTerms) setPaymentTerms(cust.paymentTerms);

      if (cust.gstin) {
        const extractedState = getStateCodeFromGstin(cust.gstin);
        if (extractedState) setPlaceOfSupply(extractedState);
      }
      setStatusMessage({
        type: 'info',
        text: `✔ Customer selected: ${cust.name} (${cust.gstin ? `GSTIN: ${cust.gstin}` : 'Unregistered'})`
      });
    } else {
      setSelectedCustomer(null);
      setContactPerson('');
      setShipToAddress('');
      setBillToAddress('');
      setTaxRegNo('');
    }
  };

  // Determine Inter-State vs Intra-State
  const sellerStateCode = storeCompany?.stateCode || (storeCompany?.companyGstin ? storeCompany.companyGstin.substring(0, 2) : '33');
  const isInterState = String(sellerStateCode) !== String(placeOfSupply);

  // Line Calculations
  const computedLines = useMemo(() => {
    return lines.map(line => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unitPrice) || 0;
      const discPct = Number(line.discountPercent) || 0;
      const gross = qty * price;
      const discAmt = gross * (discPct / 100);
      const lineTotal = Math.max(0, gross - discAmt);
      return {
        ...line,
        lineGross: gross,
        lineDiscount: discAmt,
        lineTotal: lineTotal
      };
    });
  }, [lines]);

  // Active (Non-Empty) Lines
  const activeLines = useMemo(() => {
    return computedLines.filter(l => l.productId && l.quantity > 0);
  }, [computedLines]);

  // Financial Summary Computations (PO-style round off)
  const financials = useMemo(() => {
    const totalBeforeDiscount = computedLines.reduce((sum, l) => sum + (l.lineGross || 0), 0);
    const lineDiscountTotal = computedLines.reduce((sum, l) => sum + (l.lineDiscount || 0), 0);
    const netLinesTotal = totalBeforeDiscount - lineDiscountTotal;

    const docDiscAmt = Number(discountPercent) > 0 ? (netLinesTotal * (Number(discountPercent) / 100)) : 0;
    const taxableGoods = Math.max(0, netLinesTotal - docDiscAmt);

    const fAmt = Number(freight) || 0;
    const lAmt = Number(loadingCharges) || 0;
    const pAmt = Number(packingCharges) || 0;
    const oAmt = Number(otherCharges) || 0;

    const chargesWithGst = (freightGst ? fAmt : 0) +
                           (loadingGst ? lAmt : 0) +
                           (packingGst ? pAmt : 0) +
                           (otherGst ? oAmt : 0);

    const nonGstCharges = (!freightGst ? fAmt : 0) +
                          (!loadingGst ? lAmt : 0) +
                          (!packingGst ? pAmt : 0) +
                          (!otherGst ? oAmt : 0);

    const taxableSubtotal = taxableGoods + chargesWithGst;

    let effectiveTaxRate = 5;
    if (activeLines.length > 0) {
      const sumRates = activeLines.reduce((sum, l) => sum + (Number(l.gstRate) || 5), 0);
      effectiveTaxRate = sumRates / activeLines.length;
    }

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (!isInterState) {
      cgst = Number((taxableSubtotal * (effectiveTaxRate / 2 / 100)).toFixed(2));
      sgst = Number((taxableSubtotal * (effectiveTaxRate / 2 / 100)).toFixed(2));
    } else {
      igst = Number((taxableSubtotal * (effectiveTaxRate / 100)).toFixed(2));
    }

    const totalTax = cgst + sgst + igst;
    const rawTotal = taxableSubtotal + totalTax + nonGstCharges;

    let grandTotal = rawTotal;
    let roundOff = 0;

    if (isRoundingEnabled) {
      grandTotal = Math.round(rawTotal);
      roundOff = Number((grandTotal - rawTotal).toFixed(2));
    }

    const balanceDue = Math.max(0, grandTotal - (Number(advancePaid) || 0));

    return {
      totalBeforeDiscount,
      lineDiscountTotal,
      docDiscAmt,
      taxableSubtotal,
      effectiveTaxRate,
      cgst,
      sgst,
      igst,
      totalTax,
      nonGstCharges,
      rawTotal,
      roundOff,
      grandTotal,
      balanceDue,
      amountInWords: numberToWordsINR(grandTotal)
    };
  }, [
    computedLines,
    activeLines,
    discountPercent,
    freight, freightGst,
    loadingCharges, loadingGst,
    packingCharges, packingGst,
    otherCharges, otherGst,
    isInterState,
    isRoundingEnabled,
    advancePaid
  ]);

  // Update specific line field
  const handleLineChange = (lineId, field, value) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      return { ...l, [field]: value };
    }));
  };

  // Select product for a line
  const handleSelectProductForLine = (lineId, product) => {
    if (!product) return;
    const price = getProductSalePrice(product);
    const gstPct = (Number(product.cgst || 0) + Number(product.sgst || 0)) || Number(product.igst || 0) || 5;
    const taxCd = gstPct === 18 ? 'SCG18' : (gstPct === 12 ? 'SCG12' : (gstPct === 28 ? 'SCG28' : 'SCG5'));

    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      return {
        ...l,
        productId: product.id,
        systemCode: getProductSystemCode(product),
        itemDescription: getProductName(product),
        category: getProductCategory(product),
        baseCategory: getProductBaseCategory(product),
        subcategory: getProductSubcategory(product),
        unitOfSale: getProductUnitOfSale(product),
        unitPrice: price,
        discountPercent: 0,
        taxCode: taxCd,
        gstRate: gstPct,
        stock: product.currentStock || product.stock || 0,
        rawProduct: product
      };
    }));

    setActiveLookupLineId(null);
    setInlineSearchText('');

    // Append fresh empty line if this was the last row
    setLines(prev => {
      const idx = prev.findIndex(l => l.id === lineId);
      if (idx === prev.length - 1) {
        return [...prev, createEmptyLine(prev.length + 1)];
      }
      return prev;
    });

    setStatusMessage({
      type: 'ready',
      text: `✔ Added "${getProductName(product)}" (${getProductSystemCode(product)}) @ ₹${price.toFixed(2)}`
    });
  };

  // Add line to grid from top search bar or catalog modal
  const handleAddProductFromCatalog = (product) => {
    let emptyLine = lines.find(l => !l.productId);
    if (emptyLine) {
      handleSelectProductForLine(emptyLine.id, product);
    } else {
      const newLine = createEmptyLine(lines.length + 1);
      setLines(prev => [...prev, newLine]);
      setTimeout(() => {
        handleSelectProductForLine(newLine.id, product);
      }, 50);
    }
  };

  // Remove Line
  const handleRemoveLine = (lineId) => {
    setLines(prev => {
      if (prev.length <= 1) {
        return [createEmptyLine(1)];
      }
      const filtered = prev.filter(l => l.id !== lineId);
      return filtered.map((l, i) => ({ ...l, rowNo: i + 1 }));
    });
  };

  // Add empty line
  const handleAddLine = () => {
    setLines(prev => [...prev, createEmptyLine(prev.length + 1)]);
  };

  // Clear all empty lines
  const handleClearEmptyLines = () => {
    const filled = lines.filter(l => l.productId);
    if (filled.length === 0) {
      setLines([createEmptyLine(1)]);
    } else {
      setLines(filled.map((l, i) => ({ ...l, rowNo: i + 1 })));
    }
  };

  // Submit Sales Order Mutation
  const createOrderMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/orders/sales-order', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['orders']);
      queryClient.invalidateQueries(['orders-count']);

      Swal.fire({
        title: 'Sales Order Created!',
        html: `
          <div class="text-left font-sans text-sm space-y-2 p-2">
            <div class="flex justify-between border-b pb-1">
              <span class="text-slate-500">Document No:</span>
              <span class="font-bold text-slate-800">${data.docNo || docNo}</span>
            </div>
            <div class="flex justify-between border-b pb-1">
              <span class="text-slate-500">Customer:</span>
              <span class="font-medium">${selectedCustomer?.name || 'Customer'}</span>
            </div>
            <div class="flex justify-between border-b pb-1">
              <span class="text-slate-500">Total Items:</span>
              <span class="font-bold">${activeLines.length} Lines</span>
            </div>
            <div class="flex justify-between pt-1">
              <span class="font-bold text-slate-700">Total Payment Due:</span>
              <span class="font-bold text-emerald-600 text-base">₹${financials.grandTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        `,
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: '🖨️ Print Tax Invoice / Order PDF',
        cancelButtonText: 'Create Another Order',
        confirmButtonColor: '#f0b429'
      }).then((result) => {
        if (result.isConfirmed) {
          handlePrintPDF(data);
        }
        handleResetForm();
      });
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.message || 'Failed to save sales order';
      setStatusMessage({
        type: 'error',
        text: `✖ Error: ${msg}`
      });
      Swal.fire({
        icon: 'error',
        title: 'Order Creation Failed',
        text: msg
      });
    }
  });

  // Handle Form Submit
  const handleSaveOrder = () => {
    if (!customerId) {
      setStatusMessage({
        type: 'error',
        text: '✖ You must select a Customer before adding this Sales Order.'
      });
      Swal.fire({
        icon: 'warning',
        title: 'Customer Required',
        text: 'Please choose a Customer / Business Partner from the list.'
      });
      return;
    }

    if (activeLines.length === 0) {
      setStatusMessage({
        type: 'error',
        text: '✖ Document must contain at least one item line.'
      });
      Swal.fire({
        icon: 'warning',
        title: 'No Items in Order',
        text: 'Please select at least one finished product into the table grid.'
      });
      return;
    }

    const payload = {
      docNo: docNo,
      documentSeries: docSeries,
      type: 'Sales Order',
      status: docStatus === 'Open' ? 'Confirmed' : 'Quotation',
      customerId: customerId,
      customerName: selectedCustomer?.name,
      customerPhone: selectedCustomer?.phone,
      postingDate: parseDMYtoYMD(postingDate),
      deliveryDate: parseDMYtoYMD(deliveryDate),
      documentDate: parseDMYtoYMD(documentDate),
      customerRefNo: customerRefNo,
      salesEmployee: salesEmployee,
      owner: owner,
      remarks: remarks,
      internalNote: remarks,
      deliveryAddress: shipToAddress,
      billingAddress: billToAddress,
      shippingMethod: shippingMethod,
      transporterName: transporterName,
      vehicleNo: vehicleNo,
      lrNo: lrNo,
      ewayBillNo: ewayBillNo,
      paymentTerms: paymentTerms,
      paymentMethod: paymentMethod,
      amountPaid: Number(advancePaid) || 0,
      placeOfSupply: placeOfSupply,
      sellerStateCode: sellerStateCode,
      buyerStateCode: placeOfSupply,
      discountPercent: Number(discountPercent) || 0,
      discountValue: financials.docDiscAmt,
      freight: Number(freight) || 0,
      freightGst: Boolean(freightGst),
      loadingCharges: Number(loadingCharges) || 0,
      loadingGst: Boolean(loadingGst),
      packingCharges: Number(packingCharges) || 0,
      packingGst: Boolean(packingGst),
      otherCharges: Number(otherCharges) || 0,
      otherGst: Boolean(otherGst),
      roundOff: financials.roundOff,
      grandTotal: financials.grandTotal,
      items: activeLines.map(l => ({
        productId: l.productId,
        productName: l.itemDescription,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discountPercent: Number(l.discountPercent) || 0,
        discount: Number(l.lineDiscount) || 0,
        gstRate: Number(l.gstRate) || 5,
        subtotal: Number(l.lineTotal),
        uomName: l.unitOfSale
      }))
    };

    createOrderMutation.mutate(payload);
  };

  // Reset Form
  const handleResetForm = () => {
    setCustomerId('');
    setSelectedCustomer(null);
    setCustomerRefNo('');
    setContactPerson('');
    setShipToAddress('');
    setBillToAddress('');
    setLines([
      createEmptyLine(1),
      createEmptyLine(2),
      createEmptyLine(3),
      createEmptyLine(4),
      createEmptyLine(5)
    ]);
    setRemarks('');
    setDiscountPercent(0);
    setFreight(0);
    setLoadingCharges(0);
    setPackingCharges(0);
    setOtherCharges(0);
    setAdvancePaid(0);
    const nextNum = Number(docNo || 100100000) + 1;
    setDocNo(String(nextNum));
    setStatusMessage({
      type: 'ready',
      text: '✔ Form reset - ready for new document'
    });
  };

  // Generate & Print A4 PDF
  const handlePrintPDF = (orderPayload) => {
    const orderData = orderPayload || {
      docNo: docNo,
      referenceNo: `SO-${docNo}`,
      type: 'Sales Order',
      createdAt: postingDate,
      deliveryDate: deliveryDate,
      customer: selectedCustomer || {
        name: 'Valued Customer',
        address: shipToAddress,
        gstin: taxRegNo,
        phone: contactPerson
      },
      buyerStateCode: placeOfSupply,
      sellerStateCode: sellerStateCode,
      paymentTerms: paymentTerms,
      transporterName: transporterName,
      vehicleNo: vehicleNo,
      lrNo: lrNo,
      items: activeLines.map(l => ({
        productId: l.productId,
        productName: l.itemDescription,
        hsnCode: l.rawProduct?.hsnCode || '21050000',
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discountPercent: Number(l.discountPercent) || 0,
        subtotal: Number(l.lineTotal),
        gstRate: Number(l.gstRate) || 5,
        uomName: l.unitOfSale
      })),
      totalSubtotal: financials.taxableSubtotal,
      invoiceDiscount: financials.docDiscAmt,
      freight: freight,
      loadingCharges: loadingCharges,
      packingCharges: packingCharges,
      otherCharges: otherCharges,
      cgst: financials.cgst,
      sgst: financials.sgst,
      igst: financials.igst,
      roundOff: financials.roundOff,
      grandTotal: financials.grandTotal,
      internalNote: remarks
    };

    try {
      generateA4TaxInvoice(orderData, storeCompany);
    } catch (e) {
      console.error('Error generating PDF:', e);
      Swal.fire({
        icon: 'error',
        title: 'PDF Generation Error',
        text: e.message
      });
    }
  };

  // Top Quick Product Search Filtered Results
  const topFilteredProducts = useMemo(() => {
    if (!topSearchText.trim()) return products.slice(0, 40);
    const q = topSearchText.toLowerCase().trim();
    return products.filter(p => {
      const code = getProductSystemCode(p).toLowerCase();
      const name = getProductName(p).toLowerCase();
      const cat = getProductCategory(p).toLowerCase();
      const baseCat = getProductBaseCategory(p).toLowerCase();
      const subcat = getProductSubcategory(p).toLowerCase();
      return code.includes(q) || name.includes(q) || cat.includes(q) || baseCat.includes(q) || subcat.includes(q);
    }).slice(0, 40);
  }, [products, topSearchText]);

  // Filtered Catalog Items for Modal Drawer
  const filteredCatalogItems = useMemo(() => {
    return products.filter(p => {
      const matchCat = catalogCategory === 'All' || p.category === catalogCategory;
      const q = searchCatalogQuery.toLowerCase().trim();
      const matchQuery = !q ||
        getProductSystemCode(p).toLowerCase().includes(q) ||
        getProductName(p).toLowerCase().includes(q) ||
        getProductCategory(p).toLowerCase().includes(q) ||
        getProductBaseCategory(p).toLowerCase().includes(q) ||
        getProductSubcategory(p).toLowerCase().includes(q) ||
        (p.hsnCode && p.hsnCode.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [products, catalogCategory, searchCatalogQuery]);

  // Inline Autocomplete Results for Line Items
  const inlineFilteredProducts = useMemo(() => {
    if (!inlineSearchText.trim()) return products.slice(0, 30);
    const q = inlineSearchText.toLowerCase().trim();
    return products.filter(p =>
      getProductSystemCode(p).toLowerCase().includes(q) ||
      getProductName(p).toLowerCase().includes(q) ||
      getProductCategory(p).toLowerCase().includes(q)
    ).slice(0, 30);
  }, [products, inlineSearchText]);

  return (
    <div className="sap-doc-container min-h-screen w-full bg-[var(--sap-bg-window)] text-[var(--sap-text)] font-sans text-xs antialiased selection:bg-amber-300 selection:text-slate-900 flex flex-col">
      <style>{sapStyles}</style>

      {/* FULL SCREEN DOCUMENT WINDOW HEADER */}
      <div className="w-full bg-[var(--sap-titlebar)] text-[var(--sap-titlebar-text)] px-4 py-2 flex items-center justify-between select-none border-b border-[var(--sap-border-inner)] shadow-sm">
        <div className="flex items-center gap-2.5 font-bold text-sm tracking-wide">
          <span className="text-amber-400 text-base">📋</span>
          <span>Sales Order</span>
          <span className="text-xs font-normal text-slate-300 opacity-80 pl-2.5 border-l border-slate-600">
            Enterprise Document Studio • Full View • Intra-State (33)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCatalogModal(true)}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Browse 207 Finished Products"
          >
            <Package className="w-3.5 h-3.5" />
            <span>Product Catalog (207 Items)</span>
          </button>
          
          <button
            type="button"
            onClick={() => handleResetForm()}
            className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-xs flex items-center gap-1"
            title="Reset Form"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>New Order</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/sales/list')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-red-700 text-slate-200 text-xs rounded-xs flex items-center gap-1 ml-1"
            title="Exit / Back to Orders"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* FULL SCREEN DOCUMENT HEADER SECTION (Two Columns) */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 p-3 bg-[var(--sap-bg-window)] border-b border-[var(--sap-border-inner)] shadow-xs">
        
        {/* Left Column: Customer & Shipping Details (Cols 7) */}
        <div className="lg:col-span-7 space-y-1.5">
          
          {/* Customer Code */}
          <div className="flex items-center">
            <label className="w-32 text-[var(--sap-text-muted)] font-semibold text-[11.5px] shrink-0">
              Customer <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-1 flex-1 max-w-[420px]">
              <input
                type="text"
                readOnly
                value={selectedCustomer ? (selectedCustomer.code || `CUST-${selectedCustomer.id.slice(0, 5).toUpperCase()}`) : ''}
                placeholder="Choose Customer..."
                className="w-32 h-[23px] px-2 text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] font-mono font-bold outline-none"
              />
              <button
                type="button"
                onClick={() => setShowQuickAddModal(true)}
                className="w-[23px] h-[23px] bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center rounded-xs shrink-0 cursor-pointer shadow-xs"
                title="Quick Add Customer (+91)"
              >
                ➔
              </button>
              <button
                type="button"
                onClick={() => setShowQuickAddModal(true)}
                className="px-2 h-[23px] bg-[var(--sap-btn-sec)] hover:bg-[var(--sap-btn-sec-hover)] border border-[var(--sap-border-inner)] text-[11px] font-semibold text-[var(--sap-text)] flex items-center gap-1 rounded-xs"
              >
                <UserPlus className="w-3 h-3 text-amber-600" />
                <span>+ Quick Add (+91)</span>
              </button>
            </div>
          </div>

          {/* Customer Name */}
          <div className="flex items-center">
            <label className="w-32 text-[var(--sap-text-muted)] font-semibold text-[11.5px] shrink-0">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <div className="flex-1 max-w-[460px]">
              <SearchSelect
                options={customers.map(c => ({
                  value: c.id,
                  label: c.name,
                  subLabel: `${c.phone || ''} ${c.gstin ? `• ${c.gstin}` : ''}`
                }))}
                value={customerId}
                onChange={handleCustomerChange}
                placeholder="Search and Select Customer / Business Partner..."
                size="sm"
                className="h-[24px] text-[11.5px]"
              />
            </div>
          </div>

          {/* Contact Person */}
          <div className="flex items-center">
            <label className="w-32 text-[var(--sap-text-muted)] text-[11.5px] shrink-0">
              Contact Person
            </label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Contact phone or person name"
              className="flex-1 max-w-[420px] h-[23px] px-2 text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none focus:border-blue-500"
            />
          </div>

          {/* Customer Ref. No. */}
          <div className="flex items-center">
            <label className="w-32 text-[var(--sap-text-muted)] text-[11.5px] shrink-0">
              Customer Ref. No.
            </label>
            <input
              type="text"
              value={customerRefNo}
              onChange={(e) => setCustomerRefNo(e.target.value)}
              placeholder="Buyer PO or Reference #"
              className="flex-1 max-w-[320px] h-[23px] px-2 text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none focus:border-blue-500"
            />
          </div>

          {/* Local Currency */}
          <div className="flex items-center">
            <label className="w-32 text-[var(--sap-text-muted)] text-[11.5px] shrink-0">
              Local Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-48 h-[23px] px-2 text-[11.5px] font-medium border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
            >
              <option value="INR">INR - Indian Rupee (₹)</option>
              <option value="USD">USD - US Dollar ($)</option>
            </select>
          </div>

          {/* Ship To Address */}
          <div className="flex items-start">
            <label className="w-32 text-[var(--sap-text-muted)] text-[11.5px] shrink-0 pt-0.5">
              Ship To Address
            </label>
            <input
              type="text"
              value={shipToAddress}
              onChange={(e) => setShipToAddress(e.target.value)}
              placeholder="Destination delivery address..."
              className="flex-1 max-w-[460px] h-[23px] px-2 text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] truncate outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Right Column: Document Information (Cols 5) */}
        <div className="lg:col-span-5 space-y-1.5 lg:pl-6 lg:border-l lg:border-[var(--sap-border-inner)]">
          
          {/* Document Number & Series */}
          <div className="flex items-center justify-between sm:justify-start">
            <label className="w-28 text-[var(--sap-text-muted)] font-medium text-[11.5px] shrink-0">
              Document No.
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={docSeries}
                onChange={(e) => setDocSeries(e.target.value)}
                className="h-[23px] px-2 text-[11px] font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
              >
                <option value="Primary">Primary</option>
                <option value="SO-2026">SO-2026</option>
                <option value="WALK-IN">WALK-IN</option>
              </select>
              <input
                type="text"
                value={docNo}
                onChange={(e) => setDocNo(e.target.value)}
                className="w-28 h-[23px] px-2 text-[11.5px] font-mono font-bold border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] text-right outline-none"
              />
              <span className="text-[var(--sap-text-muted)] text-xs font-mono">- | 0</span>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between sm:justify-start">
            <label className="w-28 text-[var(--sap-text-muted)] font-medium text-[11.5px] shrink-0">
              Status
            </label>
            <div className="flex items-center gap-2">
              <select
                value={docStatus}
                onChange={(e) => setDocStatus(e.target.value)}
                className="w-32 h-[23px] px-2 text-[11px] font-bold border border-[var(--sap-border-inner)] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 outline-none"
              >
                <option value="Open">Open</option>
                <option value="Draft">Draft</option>
                <option value="Closed">Closed</option>
              </select>
              <span className="inline-flex items-center px-2 py-0.5 rounded-xs text-[10.5px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300">
                Sales Order
              </span>
            </div>
          </div>

          {/* Posting Date */}
          <div className="flex items-center justify-between sm:justify-start">
            <label className="w-28 text-[var(--sap-text-muted)] text-[11.5px] shrink-0">
              Posting Date
            </label>
            <input
              type="date"
              value={postingDate}
              onChange={(e) => setPostingDate(e.target.value)}
              className="w-40 h-[23px] px-2 text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
            />
          </div>

          {/* Delivery Date */}
          <div className="flex items-center justify-between sm:justify-start">
            <label className="w-28 text-[var(--sap-text-muted)] text-[11.5px] shrink-0">
              Delivery Date
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-40 h-[23px] px-2 text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
            />
          </div>

          {/* Document Date */}
          <div className="flex items-center justify-between sm:justify-start">
            <label className="w-28 text-[var(--sap-text-muted)] text-[11.5px] shrink-0">
              Document Date
            </label>
            <input
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className="w-40 h-[23px] px-2 text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
            />
          </div>
        </div>
      </div>

      {/* FULL SCREEN TAB STRIP */}
      <div className="w-full flex items-end px-4 pt-2 bg-[var(--sap-bg-window)] border-b border-[var(--sap-border-inner)] gap-1 select-none overflow-x-auto">
        {[
          { id: 'contents', label: 'Contents' },
          { id: 'logistics', label: 'Logistics' },
          { id: 'accounting', label: 'Accounting' },
          { id: 'tax', label: 'Tax' },
          { id: 'attachments', label: 'Attachments' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 text-[12px] font-bold border-t border-x border-[var(--sap-border-inner)] transition-colors cursor-pointer rounded-t-xs -mb-[1px] ${
              activeTab === tab.id
                ? 'bg-[var(--sap-tab-active-bg)] text-[var(--sap-text)] border-b-transparent shadow-xs'
                : 'bg-[var(--sap-tab-inactive-bg)] text-[var(--sap-text-muted)] hover:bg-[var(--sap-bg-window)] border-b-[var(--sap-border-inner)]'
            }`}
          >
            {tab.label}
            {tab.id === 'contents' && activeLines.length > 0 && (
              <span className="ml-2 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black rounded-full text-[10px]">
                {activeLines.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* FULL SCREEN TAB BODY */}
      <div className="w-full p-4 bg-[var(--sap-bg-window)] flex-1 flex flex-col">
        
        {/* TAB 1: CONTENTS (Grid & Rich Product Search Bar) */}
        {activeTab === 'contents' && (
          <div className="w-full flex-1 flex flex-col space-y-3">
            
            {/* PROMINENT QUICK PRODUCT SEARCH BAR WITH RICH DROPDOWN */}
            <div ref={searchContainerRef} className="relative w-full">
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-500 rounded-sm px-3 py-1.5 shadow-sm">
                <Search className="w-4 h-4 text-amber-500 shrink-0" />
                <input
                  type="text"
                  value={topSearchText}
                  onChange={(e) => {
                    setTopSearchText(e.target.value);
                    setIsTopSearchOpen(true);
                  }}
                  onFocus={() => setIsTopSearchOpen(true)}
                  placeholder="Quick Product Search: Type System Code (e.g. BFD101, P141), Product Name (e.g. Vanilla), Category (e.g. FD Gallon)..."
                  className="w-full bg-transparent border-0 outline-none text-xs font-semibold text-[var(--sap-text)] placeholder:text-slate-400 placeholder:font-normal"
                />
                {topSearchText && (
                  <button
                    type="button"
                    onClick={() => { setTopSearchText(''); setIsTopSearchOpen(false); }}
                    className="text-slate-400 hover:text-slate-600 text-xs px-1 font-bold"
                  >
                    ✕
                  </button>
                )}
                <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1"></div>
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(true)}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs transition-colors"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Catalog Browser (207)</span>
                </button>
              </div>

              {/* Rich Dropdown Panel displaying System Code, Name, Category, Base Category, Subcategory, Unit of Sale, Sale Price */}
              {isTopSearchOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 max-h-96 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl z-50 overflow-y-auto rounded-sm text-xs">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center text-[11px] font-bold text-slate-700 dark:text-slate-300 sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>SELECT PRODUCT TO ADD • SHOWING {topFilteredProducts.length} ITEMS</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsTopSearchOpen(false)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold"
                    >
                      ✕ Close
                    </button>
                  </div>

                  {/* Header labels for the dropdown */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-700 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider sticky top-8 z-10">
                    <div className="col-span-2">System Code *</div>
                    <div className="col-span-3">Product Name *</div>
                    <div className="col-span-2">Category *</div>
                    <div className="col-span-2">Base / Subcategory</div>
                    <div className="col-span-1 text-center">Unit of Sale *</div>
                    <div className="col-span-2 text-right">Sale Price (INR) *</div>
                  </div>

                  {/* Items List */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {topFilteredProducts.map(p => {
                      const sysCode = getProductSystemCode(p);
                      const pName = getProductName(p);
                      const cat = getProductCategory(p);
                      const baseCat = getProductBaseCategory(p);
                      const subcat = getProductSubcategory(p);
                      const unitOfSale = getProductUnitOfSale(p);
                      const price = getProductSalePrice(p);
                      const gstRate = (p.cgst || 0) + (p.sgst || 0) || 5;

                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            handleAddProductFromCatalog(p);
                            setIsTopSearchOpen(false);
                            setTopSearchText('');
                          }}
                          className="grid grid-cols-12 gap-2 px-3 py-2 hover:bg-amber-50 dark:hover:bg-slate-800 cursor-pointer items-center transition-colors group"
                        >
                          {/* System Code */}
                          <div className="col-span-2 flex items-center gap-1.5">
                            <span className="font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-xs border border-amber-200 dark:border-amber-900/60">
                              {sysCode}
                            </span>
                            <span className={`text-[10px] px-1 py-0.2 rounded-xs font-mono ${
                              Number(p.currentStock || p.stock) > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {p.currentStock || p.stock || 0}
                            </span>
                          </div>

                          {/* Product Name */}
                          <div className="col-span-3 font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors">
                            {pName}
                          </div>

                          {/* Category * */}
                          <div className="col-span-2 text-slate-600 dark:text-slate-300 font-medium truncate">
                            {cat}
                          </div>

                          {/* Base Category & Subcategory */}
                          <div className="col-span-2 text-slate-500 text-[11px] truncate">
                            {baseCat} {subcat && subcat !== '-' ? `• ${subcat}` : ''}
                          </div>

                          {/* Unit of Sale * */}
                          <div className="col-span-1 text-center font-medium text-slate-700 dark:text-slate-300">
                            {unitOfSale}
                          </div>

                          {/* Sale Price (INR) * & Add Button */}
                          <div className="col-span-2 text-right flex items-center justify-end gap-2">
                            <div>
                              <div className="font-extrabold text-slate-900 dark:text-white">
                                ₹{price.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-emerald-600 font-semibold">
                                +{gstRate}% GST
                              </div>
                            </div>
                            <button
                              type="button"
                              className="px-2 py-1 bg-amber-500 group-hover:bg-amber-600 text-slate-950 font-bold text-[10.5px] rounded-xs shadow-xs"
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {topFilteredProducts.length === 0 && (
                      <div className="p-6 text-center text-slate-400">
                        No product matches "{topSearchText}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Grid Controls Bar */}
            <div className="flex items-center justify-between text-[11.5px] pb-1">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--sap-text-muted)] font-bold">Item/Service Type:</span>
                  <select
                    value={itemServiceType}
                    onChange={(e) => setItemServiceType(e.target.value)}
                    className="h-[22px] px-2 text-[11px] font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                  >
                    <option value="Item">Item</option>
                    <option value="Service">Service</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--sap-text-muted)] font-bold">Summary Type:</span>
                  <select
                    className="h-[22px] px-2 text-[11px] font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                  >
                    <option>No Summary</option>
                    <option>By Category</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="px-3 py-1 bg-[var(--sap-btn-sec)] hover:bg-[var(--sap-btn-sec-hover)] border border-[var(--sap-border-inner)] text-[11px] text-[var(--sap-text)] font-bold rounded-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+ Add Row</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearEmptyLines}
                  className="px-3 py-1 bg-[var(--sap-btn-sec)] hover:bg-[var(--sap-btn-sec-hover)] border border-[var(--sap-border-inner)] text-[11px] text-[var(--sap-text)] font-bold rounded-xs flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  <span>Clear Empty Rows</span>
                </button>
              </div>
            </div>

            {/* FULL SCREEN DOCUMENT LINE TABLE GRID */}
            <div className="w-full flex-1 border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] overflow-x-auto max-h-[460px] shadow-sm">
              <table className="w-full min-w-[1180px] border-collapse text-[11.5px] select-text">
                <thead>
                  <tr className="bg-[var(--sap-header-bg)] text-[var(--sap-text)] border-b border-[var(--sap-border-inner)] sticky top-0 z-10 font-bold select-none text-[11px]">
                    <th className="w-10 py-1.5 px-1 border-r border-[var(--sap-border-inner)] text-center">#</th>
                    <th className="w-36 py-1.5 px-2 border-r border-[var(--sap-border-inner)] text-left">System Code *</th>
                    <th className="w-64 py-1.5 px-2 border-r border-[var(--sap-border-inner)] text-left">Product Name *</th>
                    <th className="w-36 py-1.5 px-2 border-r border-[var(--sap-border-inner)] text-left">Category *</th>
                    <th className="w-48 py-1.5 px-2 border-r border-[var(--sap-border-inner)] text-left">Base / Subcategory</th>
                    <th className="w-24 py-1.5 px-2 border-r border-[var(--sap-border-inner)] text-center">Unit of Sale *</th>
                    <th className="w-20 py-1.5 px-2 border-r border-[var(--sap-border-inner)] text-right">Quantity</th>
                    <th className="w-28 py-1.5 px-2 border-r border-[var(--sap-border-inner)] text-right">Sale Price (INR) *</th>
                    <th className="w-20 py-1.5 px-2 border-r border-[var(--sap-border-inner)] text-right">Discount %</th>
                    <th className="w-24 py-1.5 px-2 border-r border-[var(--sap-border-inner)] text-left">Tax Code</th>
                    <th className="w-32 py-1.5 px-2 border-r border-[var(--sap-border-inner)] text-right">Total (LC)</th>
                    <th className="w-16 py-1.5 px-1 border-r border-[var(--sap-border-inner)] text-center">Stock</th>
                    <th className="w-10 py-1.5 px-1 text-center">✕</th>
                  </tr>
                </thead>
                <tbody>
                  {computedLines.map((line, idx) => (
                    <tr
                      key={line.id}
                      className={`h-[25px] border-b border-[var(--sap-border-inner)] hover:bg-amber-50/40 dark:hover:bg-blue-950/20 ${
                        idx % 2 === 1 ? 'bg-[var(--sap-grid-alt)]' : 'bg-[var(--sap-input-bg)]'
                      }`}
                    >
                      {/* Row # */}
                      <td className="border-r border-[var(--sap-border-inner)] text-center text-[var(--sap-text-muted)] font-mono text-[11px]">
                        {line.rowNo}
                      </td>

                      {/* System Code with Orange Drill-down */}
                      <td className="border-r border-[var(--sap-border-inner)] p-0 relative">
                        <div className="flex items-center h-full">
                          <input
                            type="text"
                            value={line.systemCode}
                            placeholder="Code (e.g. BFD101)..."
                            onChange={(e) => {
                              handleLineChange(line.id, 'systemCode', e.target.value);
                              setActiveLookupLineId(line.id);
                              setInlineSearchText(e.target.value);
                            }}
                            onFocus={() => {
                              setActiveLookupLineId(line.id);
                              setInlineSearchText(line.systemCode || '');
                            }}
                            className="w-full h-full px-2 bg-transparent border-0 outline-none font-mono font-bold text-[11px] text-[var(--sap-text)]"
                          />
                          {line.productId && (
                            <button
                              type="button"
                              onClick={() => {
                                setStockQueryProductId(line.productId);
                                setIsStockQueryOpen(true);
                              }}
                              className="w-5 h-full text-[var(--sap-drilldown)] font-extrabold text-[12px] flex items-center justify-center shrink-0 hover:scale-125 cursor-pointer"
                              title="Drill-down into stock & batches"
                            >
                              ➔
                            </button>
                          )}
                        </div>

                        {/* Inline Autocomplete Dropdown */}
                        {activeLookupLineId === line.id && (
                          <div className="absolute top-[25px] left-0 w-96 max-h-56 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl z-50 overflow-y-auto rounded-xs text-[11px]">
                            <div className="p-1.5 bg-slate-100 dark:bg-slate-800 text-[10.5px] font-bold text-slate-600 flex justify-between border-b">
                              <span>SELECT PRODUCT ({inlineFilteredProducts.length})</span>
                              <button
                                type="button"
                                onClick={() => setActiveLookupLineId(null)}
                                className="text-slate-400 hover:text-slate-600 font-bold"
                              >
                                ✕
                              </button>
                            </div>
                            {inlineFilteredProducts.map(p => (
                              <div
                                key={p.id}
                                onClick={() => handleSelectProductForLine(line.id, p)}
                                className="px-2.5 py-1.5 hover:bg-amber-100 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 cursor-pointer flex justify-between items-center"
                              >
                                <div>
                                  <div className="font-bold text-slate-800 dark:text-slate-200">
                                    <span className="font-mono text-amber-700 dark:text-amber-400 mr-1.5">
                                      {getProductSystemCode(p)}
                                    </span>
                                    {getProductName(p)}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {getProductCategory(p)} • {getProductBaseCategory(p)} • {getProductUnitOfSale(p)}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    ₹{getProductSalePrice(p).toFixed(2)}
                                  </div>
                                  <div className="text-[9.5px] text-emerald-600">
                                    +{(p.cgst || 0) + (p.sgst || 0) || 5}% GST
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Product Name * */}
                      <td className="border-r border-[var(--sap-border-inner)] p-0">
                        <input
                          type="text"
                          value={line.itemDescription}
                          placeholder="Product Name..."
                          onChange={(e) => {
                            handleLineChange(line.id, 'itemDescription', e.target.value);
                            setActiveLookupLineId(line.id);
                            setInlineSearchText(e.target.value);
                          }}
                          onFocus={() => {
                            setActiveLookupLineId(line.id);
                            setInlineSearchText(line.itemDescription || '');
                          }}
                          className="w-full h-full px-2 bg-transparent border-0 outline-none font-semibold text-[11.5px] text-[var(--sap-text)]"
                        />
                      </td>

                      {/* Category * */}
                      <td className="border-r border-[var(--sap-border-inner)] px-2 text-[11px] text-[var(--sap-text-muted)] truncate">
                        {line.category || '-'}
                      </td>

                      {/* Base / Subcategory */}
                      <td className="border-r border-[var(--sap-border-inner)] px-2 text-[10.5px] text-[var(--sap-text-muted)] truncate">
                        {line.baseCategory ? `${line.baseCategory}${line.subcategory && line.subcategory !== '-' ? ` • ${line.subcategory}` : ''}` : '-'}
                      </td>

                      {/* Unit of Sale * */}
                      <td className="border-r border-[var(--sap-border-inner)] text-center text-[11px] font-semibold text-[var(--sap-text)]">
                        {line.unitOfSale || 'pcs'}
                      </td>

                      {/* Quantity */}
                      <td className="border-r border-[var(--sap-border-inner)] p-0">
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => handleLineChange(line.id, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full h-full px-2 bg-transparent border-0 outline-none text-right font-mono font-bold text-[11.5px] text-[var(--sap-text)]"
                        />
                      </td>

                      {/* Sale Price (INR) * */}
                      <td className="border-r border-[var(--sap-border-inner)] p-0">
                        <input
                          type="number"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) => handleLineChange(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full h-full px-2 bg-transparent border-0 outline-none text-right font-mono font-semibold text-[11.5px] text-[var(--sap-text)]"
                        />
                      </td>

                      {/* Discount % */}
                      <td className="border-r border-[var(--sap-border-inner)] p-0">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={line.discountPercent}
                          onChange={(e) => handleLineChange(line.id, 'discountPercent', parseFloat(e.target.value) || 0)}
                          className="w-full h-full px-2 bg-transparent border-0 outline-none text-right font-mono text-[11.5px] text-[var(--sap-text)]"
                        />
                      </td>

                      {/* Tax Code */}
                      <td className="border-r border-[var(--sap-border-inner)] p-0">
                        <select
                          value={line.taxCode}
                          onChange={(e) => {
                            const val = e.target.value;
                            let rate = 5;
                            if (val === 'SCG18') rate = 18;
                            if (val === 'SCG12') rate = 12;
                            if (val === 'SCG28') rate = 28;
                            if (val === 'EXEMPT') rate = 0;
                            handleLineChange(line.id, 'taxCode', val);
                            handleLineChange(line.id, 'gstRate', rate);
                          }}
                          className="w-full h-full px-1.5 bg-transparent border-0 outline-none text-[11px] font-medium text-[var(--sap-text)]"
                        >
                          <option value="SCG5">SCG5 (5%)</option>
                          <option value="SCG12">SCG12 (12%)</option>
                          <option value="SCG18">SCG18 (18%)</option>
                          <option value="SCG28">SCG28 (28%)</option>
                          <option value="EXEMPT">EXEMPT (0%)</option>
                        </select>
                      </td>

                      {/* Total (LC) */}
                      <td className="border-r border-[var(--sap-border-inner)] px-2 text-right font-mono font-bold text-[11.5px] text-[var(--sap-text)] bg-[var(--sap-input-readonly)]">
                        {line.lineTotal ? `${line.lineTotal.toFixed(2)} INR` : '0.00 INR'}
                      </td>

                      {/* Direct Stock */}
                      <td className="border-r border-[var(--sap-border-inner)] text-center text-[10.5px]">
                        <span className={`px-1.5 py-0.2 rounded-xs font-mono font-bold ${
                          Number(line.stock) > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {line.stock}
                        </span>
                      </td>

                      {/* Delete Row */}
                      <td className="text-center p-0">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.id)}
                          className="w-full h-full text-slate-400 hover:text-red-600 font-bold flex items-center justify-center cursor-pointer"
                          title="Delete Line"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: LOGISTICS */}
        {activeTab === 'logistics' && (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 text-[11.5px]">
            <div className="space-y-3">
              <div className="font-bold text-slate-800 dark:text-slate-200 border-b pb-1 text-xs">
                Destination & Delivery Addresses
              </div>
              <div>
                <label className="block text-[var(--sap-text-muted)] font-medium mb-1">Ship-To Address</label>
                <textarea
                  rows={4}
                  value={shipToAddress}
                  onChange={(e) => setShipToAddress(e.target.value)}
                  placeholder="Enter complete shipping destination address..."
                  className="w-full p-2 text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                />
              </div>
              <div>
                <label className="block text-[var(--sap-text-muted)] font-medium mb-1">Bill-To Address</label>
                <textarea
                  rows={4}
                  value={billToAddress}
                  onChange={(e) => setBillToAddress(e.target.value)}
                  placeholder="Enter customer billing address..."
                  className="w-full p-2 text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="font-bold text-slate-800 dark:text-slate-200 border-b pb-1 text-xs">
                Transport & Dispatch Logistics
              </div>
              <div className="flex items-center">
                <label className="w-36 text-[var(--sap-text-muted)] font-medium">Shipping Method</label>
                <select
                  value={shippingMethod}
                  onChange={(e) => setShippingMethod(e.target.value)}
                  className="flex-1 h-[24px] px-2 text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                >
                  <option value="Road Transport">Road Transport</option>
                  <option value="Rail">Rail Cargo</option>
                  <option value="Air Cargo">Air Cargo</option>
                  <option value="Express Courier">Express Courier</option>
                  <option value="Self Pickup">Customer Self-Pickup</option>
                </select>
              </div>
              <div className="flex items-center">
                <label className="w-36 text-[var(--sap-text-muted)] font-medium">Transporter Name</label>
                <input
                  type="text"
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                  placeholder="Carrier or Agency name..."
                  className="flex-1 h-[24px] px-2 text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                />
              </div>
              <div className="flex items-center">
                <label className="w-36 text-[var(--sap-text-muted)] font-medium">Vehicle No</label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="e.g. TN-01-AB-1234"
                  className="flex-1 h-[24px] px-2 text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                />
              </div>
              <div className="flex items-center">
                <label className="w-36 text-[var(--sap-text-muted)] font-medium">Docket / LR Number</label>
                <input
                  type="text"
                  value={lrNo}
                  onChange={(e) => setLrNo(e.target.value)}
                  placeholder="LR-000000"
                  className="flex-1 h-[24px] px-2 text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                />
              </div>
              <div className="flex items-center">
                <label className="w-36 text-[var(--sap-text-muted)] font-medium">e-Way Bill No.</label>
                <input
                  type="text"
                  value={ewayBillNo}
                  onChange={(e) => setEwayBillNo(e.target.value)}
                  placeholder="12-digit e-way bill number"
                  className="flex-1 h-[24px] px-2 text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ACCOUNTING */}
        {activeTab === 'accounting' && (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 text-[11.5px]">
            <div className="space-y-2.5">
              <div className="font-bold text-slate-800 dark:text-slate-200 border-b pb-1 text-xs">
                Payment Terms & Settlement
              </div>
              <div className="flex items-center">
                <label className="w-36 text-[var(--sap-text-muted)] font-medium">Payment Terms</label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="flex-1 h-[24px] px-2 text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none font-semibold"
                >
                  <option value="Not Paid">Not Paid</option>
                  <option value="Immediate Cash">Immediate Cash</option>
                  <option value="Net 15">Net 15 Days</option>
                  <option value="Net 30">Net 30 Days</option>
                  <option value="Advance Received">Advance Received</option>
                </select>
              </div>
              <div className="flex items-center">
                <label className="w-36 text-[var(--sap-text-muted)] font-medium">Payment Mode</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="flex-1 h-[24px] px-2 text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                >
                  <option value="Bank Transfer / NEFT">Bank Transfer / NEFT</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI / QR">UPI / QR Code</option>
                  <option value="Credit / Debit Card">Credit / Debit Card</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div className="flex items-center">
                <label className="w-36 text-[var(--sap-text-muted)] font-medium">Advance Received (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={advancePaid}
                  onChange={(e) => setAdvancePaid(parseFloat(e.target.value) || 0)}
                  className="w-44 h-[24px] px-2 text-[11.5px] font-mono font-bold text-right border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                />
              </div>
              <div className="flex items-center">
                <label className="w-36 text-[var(--sap-text-muted)] font-bold">Balance Due</label>
                <div className="font-mono font-extrabold text-emerald-700 text-sm">
                  ₹{financials.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="font-bold text-slate-800 dark:text-slate-200 border-b pb-1 text-xs">
                Financial Records & BP Account
              </div>
              <div className="flex items-center">
                <label className="w-36 text-[var(--sap-text-muted)] font-medium">Journal Remark</label>
                <input
                  type="text"
                  readOnly
                  value={`Sales Order - ${selectedCustomer?.name || 'Customer'}`}
                  className="flex-1 h-[24px] px-2 text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
                />
              </div>
              <div className="flex items-center">
                <label className="w-36 text-[var(--sap-text-muted)] font-medium">BP Bank Code</label>
                <input
                  type="text"
                  readOnly
                  value={selectedCustomer?.bankAccount ? `${selectedCustomer.bankName || 'SBI'} (${selectedCustomer.bankAccount})` : 'Primary Bank Default'}
                  className="flex-1 h-[24px] px-2 text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TAX & CHARGES LEDGER */}
        {activeTab === 'tax' && (
          <div className="w-full space-y-4 text-[11.5px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* GST Intelligence */}
              <div className="space-y-2.5 p-3 border border-[var(--sap-border-inner)] bg-[var(--sap-bg-window)] rounded-xs">
                <div className="font-bold text-slate-800 dark:text-slate-200 border-b pb-1 flex items-center justify-between">
                  <span>GST Treatment & Supply State</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-xs bg-blue-100 text-blue-800 font-bold">
                    Intelligent Detection
                  </span>
                </div>
                <div className="flex items-center">
                  <label className="w-36 text-[var(--sap-text-muted)] font-medium">Customer GSTIN</label>
                  <input
                    type="text"
                    value={taxRegNo}
                    onChange={(e) => setTaxRegNo(e.target.value.toUpperCase())}
                    placeholder="33AAAAA0000A1Z5"
                    className="flex-1 h-[24px] px-2 font-mono font-bold text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] uppercase outline-none"
                  />
                </div>
                <div className="flex items-center">
                  <label className="w-36 text-[var(--sap-text-muted)] font-medium">Place of Supply</label>
                  <select
                    value={placeOfSupply}
                    onChange={(e) => setPlaceOfSupply(e.target.value)}
                    className="flex-1 h-[24px] px-2 text-[11.5px] font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                  >
                    {getIndianStates().map(st => (
                      <option key={st.code} value={st.code}>
                        {st.code} - {st.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xs text-[11px] text-blue-900 dark:text-blue-300">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>{isInterState ? '🌐 Inter-State Supply (IGST Applied)' : '🏛️ Intra-State Supply (CGST + SGST Applied)'}</span>
                  </div>
                  <div className="text-[10.5px] opacity-85 mt-0.5">
                    Seller: Tamil Nadu (33) ➔ Buyer Place of Supply: State ({placeOfSupply})
                  </div>
                </div>
              </div>

              {/* Charges & Tax Ledger */}
              <div className="space-y-2.5 p-3 border border-[var(--sap-border-inner)] bg-[var(--sap-bg-window)] rounded-xs">
                <div className="font-bold text-slate-800 dark:text-slate-200 border-b pb-1">
                  Charges & Tax Ledger
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[var(--sap-text-muted)] font-semibold text-[11px]">Freight (₹)</label>
                      <label className="flex items-center gap-1 text-[10.5px] font-bold">
                        <input
                          type="checkbox"
                          checked={freightGst}
                          onChange={(e) => setFreightGst(e.target.checked)}
                          className="accent-amber-500"
                        />
                        <span>GST</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={freight}
                      onChange={(e) => setFreight(parseFloat(e.target.value) || 0)}
                      className="w-full h-[24px] px-2 text-right font-mono font-bold text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[var(--sap-text-muted)] font-semibold text-[11px]">Loading (₹)</label>
                      <label className="flex items-center gap-1 text-[10.5px] font-bold">
                        <input
                          type="checkbox"
                          checked={loadingGst}
                          onChange={(e) => setLoadingGst(e.target.checked)}
                          className="accent-amber-500"
                        />
                        <span>GST</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={loadingCharges}
                      onChange={(e) => setLoadingCharges(parseFloat(e.target.value) || 0)}
                      className="w-full h-[24px] px-2 text-right font-mono font-bold text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[var(--sap-text-muted)] font-semibold text-[11px]">Packing (₹)</label>
                      <label className="flex items-center gap-1 text-[10.5px] font-bold">
                        <input
                          type="checkbox"
                          checked={packingGst}
                          onChange={(e) => setLoadingPackingGst(e.target.checked)}
                          className="accent-amber-500"
                        />
                        <span>GST</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={packingCharges}
                      onChange={(e) => setPackingCharges(parseFloat(e.target.value) || 0)}
                      className="w-full h-[24px] px-2 text-right font-mono font-bold text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[var(--sap-text-muted)] font-semibold text-[11px]">Other Charges (₹)</label>
                      <label className="flex items-center gap-1 text-[10.5px] font-bold">
                        <input
                          type="checkbox"
                          checked={otherGst}
                          onChange={(e) => setOtherGst(e.target.checked)}
                          className="accent-amber-500"
                        />
                        <span>GST</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={otherCharges}
                      onChange={(e) => setOtherCharges(parseFloat(e.target.value) || 0)}
                      className="w-full h-[24px] px-2 text-right font-mono font-bold text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tax Ledger Summary Display */}
            <div className="p-3 bg-[var(--sap-header-bg)] border border-[var(--sap-border-inner)] rounded-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-[11px] text-[var(--sap-text-muted)] font-bold">Taxable Subtotal</div>
                  <div className="font-mono font-bold text-sm text-[var(--sap-text)]">
                    ₹{financials.taxableSubtotal.toFixed(2)}
                  </div>
                </div>
                {!isInterState ? (
                  <>
                    <div>
                      <div className="text-[11px] text-[var(--sap-text-muted)] font-bold">CGST (@2.5%)</div>
                      <div className="font-mono font-bold text-sm text-[var(--sap-text)]">
                        ₹{financials.cgst.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[var(--sap-text-muted)] font-bold">SGST (@2.5%)</div>
                      <div className="font-mono font-bold text-sm text-[var(--sap-text)]">
                        ₹{financials.sgst.toFixed(2)}
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="text-[11px] text-[var(--sap-text-muted)] font-bold">IGST (@5%)</div>
                    <div className="font-mono font-bold text-sm text-[var(--sap-text)]">
                      ₹{financials.igst.toFixed(2)}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-[11px] text-[var(--sap-text-muted)] font-bold">Total GST Tax</div>
                  <div className="font-mono font-bold text-sm text-emerald-700">
                    ₹{financials.totalTax.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ATTACHMENTS & REMARKS */}
        {activeTab === 'attachments' && (
          <div className="w-full space-y-3 text-[11.5px]">
            <div>
              <label className="block text-[var(--sap-text-muted)] font-bold mb-1">
                Sales Order Remarks & Dispatch Instructions
              </label>
              <textarea
                rows={5}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter dispatch notes, production priority, terms, or customer special requests..."
                className="w-full p-2.5 text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* FULL SCREEN BOTTOM SUMMARY SECTION (Left Staff/Remarks, Right Financial Totals with PO Round-off) */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 bg-[var(--sap-bg-window)] border-t border-[var(--sap-border-inner)] shadow-sm">
        
        {/* Left Column: Staff & Remarks (Cols 6) */}
        <div className="lg:col-span-6 space-y-2">
          <div className="flex items-center">
            <label className="w-32 text-[var(--sap-text-muted)] font-semibold text-[11.5px] shrink-0">
              Buyer / Employee
            </label>
            <select
              value={salesEmployee}
              onChange={(e) => setSalesEmployee(e.target.value)}
              className="flex-1 max-w-[340px] h-[24px] px-2 text-[11.5px] font-medium border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
            >
              <option value="-No Sales Employee-">-No Sales Employee-</option>
              {mastersData?.users?.map(u => (
                <option key={u.id} value={u.name}>
                  {u.name} ({u.role})
                </option>
              ))}
              <option value="Fran, Ambattur">Fran, Ambattur</option>
            </select>
          </div>

          <div className="flex items-center">
            <label className="w-32 text-[var(--sap-text-muted)] font-semibold text-[11.5px] shrink-0">
              Owner
            </label>
            <input
              type="text"
              readOnly
              value={owner}
              className="flex-1 max-w-[340px] h-[24px] px-2 text-[11.5px] font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
            />
          </div>

          <div className="flex items-start">
            <label className="w-32 text-[var(--sap-text-muted)] font-semibold text-[11.5px] shrink-0 pt-0.5">
              Remarks
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Order remarks..."
              className="flex-1 max-w-[420px] p-1.5 text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none resize-none"
            />
          </div>
        </div>

        {/* Right Column: Totals & Tax Breakdown (Cols 6) */}
        <div className="lg:col-span-6 flex flex-col items-end space-y-1.5 text-[11.5px]">
          
          {/* Total Before Discount */}
          <div className="flex items-center justify-end w-full max-w-[420px]">
            <label className="text-[var(--sap-text-muted)] font-semibold pr-3 text-right">Total Before Discount</label>
            <input
              type="text"
              readOnly
              value={`${financials.totalBeforeDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR`}
              className="w-48 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
            />
          </div>

          {/* Discount */}
          <div className="flex items-center justify-end w-full max-w-[420px] gap-1">
            <label className="text-[var(--sap-text-muted)] font-semibold pr-2 text-right">Discount</label>
            <div className="flex items-center gap-0.5">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                className="w-16 h-[24px] px-1 text-right font-mono font-bold border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
              />
              <span className="text-[var(--sap-text-muted)] text-[11px] font-bold">%</span>
            </div>
            <input
              type="text"
              readOnly
              value={`${financials.docDiscAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR`}
              className="w-28 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
            />
          </div>

          {/* Freight */}
          <div className="flex items-center justify-end w-full max-w-[420px]">
            <label className="text-[var(--sap-text-muted)] font-semibold pr-3 text-right">Freight</label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('tax')}
                className="text-amber-600 font-extrabold hover:scale-125 cursor-pointer text-sm"
                title="Configure Extra Charges in Tax Tab"
              >
                ➔
              </button>
              <input
                type="text"
                readOnly
                value={`${(Number(freight) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR`}
                className="w-48 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
              />
            </div>
          </div>

          {/* Rounding Checkbox & Amount (PO Order Round-off Style) */}
          <div className="flex items-center justify-end w-full max-w-[420px] gap-2">
            <label className="flex items-center gap-1.5 text-[var(--sap-text-muted)] font-bold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRoundingEnabled}
                onChange={(e) => setIsRoundingEnabled(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span>Rounding</span>
            </label>
            <input
              type="text"
              readOnly
              value={`${financials.roundOff.toFixed(2)} INR`}
              className="w-48 h-[24px] px-2 text-right font-mono font-bold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
            />
          </div>

          {/* Tax */}
          <div className="flex items-center justify-end w-full max-w-[420px]">
            <label className="text-[var(--sap-text-muted)] font-semibold pr-3 text-right">Tax</label>
            <input
              type="text"
              readOnly
              value={`${financials.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR`}
              className="w-48 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
            />
          </div>

          {/* Total Payment Due (Grand Total) */}
          <div className="flex items-center justify-end w-full max-w-[420px] pt-1">
            <label className="text-[var(--sap-text)] font-extrabold pr-3 text-right text-xs">
              Total Payment Due
            </label>
            <input
              type="text"
              readOnly
              value={`${financials.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR`}
              className="w-48 h-[26px] px-2 text-right font-mono font-black text-sm border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-emerald-700 dark:text-emerald-400 outline-none"
            />
          </div>

          {/* Amount in Words */}
          <div className="text-[10.5px] text-slate-500 font-semibold italic max-w-[420px] text-right truncate">
            {financials.amountInWords}
          </div>
        </div>
      </div>

      {/* FULL SCREEN BOTTOM ACTIONS BAR (Golden Yellow Add Button, Cancel, PDF Print, Copy From/To) */}
      <div className="w-full px-4 py-2.5 bg-[var(--sap-bg-window)] border-t border-[var(--sap-border-inner)] flex flex-wrap items-center justify-between gap-3 shadow-md">
        
        {/* Left Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={createOrderMutation.isPending}
            onClick={handleSaveOrder}
            className="px-8 h-[28px] bg-[var(--sap-btn-gold)] hover:bg-[var(--sap-btn-gold-hover)] text-[var(--sap-btn-gold-text)] font-bold text-xs border border-amber-600 rounded-xs shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {createOrderMutation.isPending ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Adding Order...</span>
              </>
            ) : (
              <span>Add</span>
            )}
          </button>

          <button
            type="button"
            onClick={handleResetForm}
            className="px-5 h-[28px] bg-[var(--sap-btn-sec)] hover:bg-[var(--sap-btn-sec-hover)] text-[var(--sap-text)] font-bold text-xs border border-[var(--sap-border-inner)] rounded-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handlePrintPDF()}
            className="px-4 h-[28px] bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 ml-2 shadow-xs"
            title="Print Tax Invoice / Order PDF"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span>Print Order / Tax Invoice</span>
          </button>
        </div>

        {/* Right Workflow Actions (Copy From / Copy To) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              Swal.fire({
                title: 'Copy From',
                text: 'Select source Quotation or Sales Agreement to import lines.',
                icon: 'info',
                confirmButtonColor: '#f0b429'
              });
            }}
            className="px-3.5 h-[28px] bg-[var(--sap-btn-sec)] hover:bg-[var(--sap-btn-sec-hover)] text-[var(--sap-text)] font-bold text-xs border border-[var(--sap-border-inner)] rounded-xs transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>Copy From</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>

          <button
            type="button"
            onClick={() => {
              Swal.fire({
                title: 'Copy To',
                text: 'Copy this Sales Order into Delivery Note or A/R Tax Invoice.',
                icon: 'info',
                confirmButtonColor: '#f0b429'
              });
            }}
            className="px-3.5 h-[28px] bg-[var(--sap-btn-sec)] hover:bg-[var(--sap-btn-sec-hover)] text-[var(--sap-text)] font-bold text-xs border border-[var(--sap-border-inner)] rounded-xs transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>Copy To</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* FULL SCREEN BOTTOM STATUS MESSAGE STRIP */}
      <div className={`w-full px-4 py-1.5 text-[11px] font-medium flex items-center justify-between border-t border-[var(--sap-border-inner)] ${
        statusMessage.type === 'error'
          ? 'bg-red-700 text-white font-bold'
          : (statusMessage.type === 'info'
              ? 'bg-blue-700 text-white font-semibold'
              : 'bg-[var(--sap-status-bar)] text-slate-300')
      }`}>
        <div className="flex items-center gap-2 truncate">
          {statusMessage.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
        <div className="flex items-center gap-4 text-[10.5px] opacity-80 shrink-0 font-mono">
          <span>{formatDateDMY(new Date())}</span>
          <span>{currentUser?.name || 'Staff'}</span>
          <span>Tamil Nadu (33)</span>
        </div>
      </div>

      {/* QUICK ADD CUSTOMER MODAL (+91) */}
      {showQuickAddModal && (
        <QuickAddCustomerModal
          onAdded={(newCust) => {
            setShowQuickAddModal(false);
            queryClient.invalidateQueries(['customers-list']);
            handleCustomerChange(newCust.id);
          }}
          onClose={() => setShowQuickAddModal(false)}
        />
      )}

      {/* FULL PRODUCT CATALOG BROWSER MODAL (207 Items - Table & Card Views with System Code, Category, Base Cat, Subcat, UoM, Price) */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl rounded-sm w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-xs">
            
            {/* Modal Header */}
            <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between select-none">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Package className="w-4 h-4 text-amber-400" />
                <span>Finished Product Catalog (207 Items)</span>
                <span className="text-xs font-normal text-slate-300 opacity-80 pl-2 border-l border-slate-600">
                  Full Product Master Specifications
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-700 rounded-xs p-0.5 border border-slate-600">
                  <button
                    type="button"
                    onClick={() => setCatalogViewMode('table')}
                    className={`px-2 py-0.5 rounded-xs flex items-center gap-1 text-[11px] font-semibold ${
                      catalogViewMode === 'table' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Table className="w-3 h-3" />
                    <span>Table View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogViewMode('cards')}
                    className={`px-2 py-0.5 rounded-xs flex items-center gap-1 text-[11px] font-semibold ${
                      catalogViewMode === 'cards' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <LayoutGrid className="w-3 h-3" />
                    <span>Cards View</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(false)}
                  className="text-slate-300 hover:text-white ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search & Category Filter Pills */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchCatalogQuery}
                  onChange={(e) => setSearchCatalogQuery(e.target.value)}
                  placeholder="Search by System Code (e.g. BFD101, P141), Product Name (e.g. Vanilla), Category, Base Category, Subcategory..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xs text-xs font-medium outline-none focus:border-amber-500"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {productCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatalogCategory(cat)}
                    className={`px-3 py-0.5 rounded-full text-[11px] font-bold shrink-0 cursor-pointer transition-colors ${
                      catalogCategory === cat
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog Content Area */}
            <div className="flex-1 overflow-y-auto p-3">
              {catalogViewMode === 'table' ? (
                /* TABLE VIEW MATCHING PRODUCT PAGE */
                <table className="w-full border-collapse text-xs select-text">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 font-bold sticky top-0 z-10 select-none">
                      <th className="py-2 px-2 text-left w-28">System Code *</th>
                      <th className="py-2 px-2 text-left">Product Name *</th>
                      <th className="py-2 px-2 text-left w-36">Category *</th>
                      <th className="py-2 px-2 text-left w-44">Base Category</th>
                      <th className="py-2 px-2 text-left w-36">Subcategory</th>
                      <th className="py-2 px-2 text-center w-24">Unit of Sale *</th>
                      <th className="py-2 px-2 text-right w-32">Sale Price (INR) *</th>
                      <th className="py-2 px-2 text-center w-20">Stock</th>
                      <th className="py-2 px-2 text-center w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCatalogItems.map(p => {
                      const sysCode = getProductSystemCode(p);
                      const pName = getProductName(p);
                      const cat = getProductCategory(p);
                      const baseCat = getProductBaseCategory(p);
                      const subcat = getProductSubcategory(p);
                      const unitOfSale = getProductUnitOfSale(p);
                      const price = getProductSalePrice(p);
                      const gstRate = (p.cgst || 0) + (p.sgst || 0) || 5;

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-amber-50 dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <td className="py-2 px-2 font-mono font-bold text-amber-700 dark:text-amber-400">
                            {sysCode}
                          </td>
                          <td className="py-2 px-2 font-bold text-slate-900 dark:text-white">
                            {pName}
                          </td>
                          <td className="py-2 px-2 text-slate-600 dark:text-slate-300 font-medium">
                            {cat}
                          </td>
                          <td className="py-2 px-2 text-slate-500 text-[11px]">
                            {baseCat}
                          </td>
                          <td className="py-2 px-2 text-slate-500 text-[11px]">
                            {subcat}
                          </td>
                          <td className="py-2 px-2 text-center font-semibold text-slate-700 dark:text-slate-300">
                            {unitOfSale}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <div className="font-extrabold text-slate-900 dark:text-white">
                              ₹{price.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-emerald-600 font-semibold">
                              +{gstRate}% GST
                            </div>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={`px-2 py-0.5 rounded-xs font-mono font-bold ${
                              Number(p.currentStock || p.stock) > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {p.currentStock || p.stock || 0}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                handleAddProductFromCatalog(p);
                                setShowCatalogModal(false);
                              }}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10.5px] rounded-xs shadow-xs flex items-center gap-1 mx-auto cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                /* CARDS VIEW */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredCatalogItems.map(p => {
                    const sysCode = getProductSystemCode(p);
                    const pName = getProductName(p);
                    const cat = getProductCategory(p);
                    const baseCat = getProductBaseCategory(p);
                    const subcat = getProductSubcategory(p);
                    const unitOfSale = getProductUnitOfSale(p);
                    const price = getProductSalePrice(p);
                    const gstRate = (p.cgst || 0) + (p.sgst || 0) || 5;

                    return (
                      <div
                        key={p.id}
                        className="p-3 border border-slate-200 dark:border-slate-800 rounded-xs bg-white dark:bg-slate-900 hover:border-amber-400 dark:hover:border-amber-500 transition-all flex flex-col justify-between shadow-xs group"
                      >
                        <div>
                          <div className="flex items-center justify-between text-[10.5px] mb-1.5">
                            <span className="font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-xs border border-amber-200 dark:border-amber-900/60">
                              {sysCode}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-xs font-mono font-bold ${
                              Number(p.currentStock || p.stock) > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              Stock: {p.currentStock || p.stock || 0}
                            </span>
                          </div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs line-clamp-1 group-hover:text-amber-600 transition-colors">
                            {pName}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                            <div><span className="font-semibold text-slate-600 dark:text-slate-400">Category:</span> {cat}</div>
                            <div><span className="font-semibold text-slate-600 dark:text-slate-400">Base:</span> {baseCat} {subcat && subcat !== '-' ? `• ${subcat}` : ''}</div>
                            <div><span className="font-semibold text-slate-600 dark:text-slate-400">Unit of Sale:</span> {unitOfSale}</div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <div>
                            <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                              ₹{price.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-emerald-600 font-semibold">
                              +{gstRate}% GST
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              handleAddProductFromCatalog(p);
                              setShowCatalogModal(false);
                            }}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] rounded-xs shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add to Grid</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-slate-600 dark:text-slate-300 text-xs">
              <span className="font-semibold">Showing {filteredCatalogItems.length} of {products.length} Products</span>
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xs font-bold hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH & STOCK QUERY MODAL */}
      {isStockQueryOpen && stockQueryProductId && (
        <ProductStockQueryModal
          productId={stockQueryProductId}
          isOpen={isStockQueryOpen}
          onClose={() => {
            setIsStockQueryOpen(false);
            setStockQueryProductId(null);
          }}
        />
      )}
    </div>
  );
}
