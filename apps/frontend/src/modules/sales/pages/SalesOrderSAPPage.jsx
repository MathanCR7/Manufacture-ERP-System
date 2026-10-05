import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import {
  FileText, Plus, Trash2, Printer, Check, X,
  AlertTriangle, ArrowRight, Building2, Calendar, Truck, DollarSign, Percent,
  ChevronDown, ChevronUp, RefreshCw, Search, ArrowLeft, ShieldAlert,
  Sparkles, Layers, Receipt, Clock, CheckCircle2, Download, Tag, UserPlus, Eye,
  Package, CreditCard, Banknote, HelpCircle, ShieldCheck, Info,
  SlidersHorizontal, CheckSquare, Square, MapPin, Globe, Moon, Sun,
  ExternalLink, ChevronRight, Minimize2, Maximize2, LayoutGrid, Table,
  Camera, Image as ImageIcon, Paperclip, UploadCloud
} from 'lucide-react';
import SearchSelect from '@/components/ui/SearchSelect';
import QuickAddCustomerModal from '@/components/forms/QuickAddCustomerModal';
import ProductStockQueryModal from '@/modules/production/components/ProductStockQueryModal';
import { calculateGST, numberToWordsINR, getIndianStates, getStateCodeFromGstin, round2 } from '@/utils/gstEngine';
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
const getProductLiveStock = (p) => Number(p?.stock !== undefined ? p.stock : (p?.currentStock !== undefined ? p.currentStock : (p?.batchStock || 0)));

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
  const [searchParams] = useSearchParams();
  const editOrderId = searchParams.get('id') || searchParams.get('edit');
  const currentUser = useAuthStore(s => s.user);
  const storeCompany = useCompanyStore(s => s.company);
  const queryClient = useQueryClient();

  // Active Tab: 'contents' | 'logistics' | 'accounting' | 'tax' | 'attachments'
  const [activeTab, setActiveTab] = useState('contents');

  // Commercial Order Fulfillment Mode: 'STANDARD' (In-Stock Only) | 'NEED_PLANNING' (Make-to-Order) | 'QUOTATION' (Quotation)
  const [orderMode, setOrderMode] = useState('STANDARD');

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
  const [packingGst, setPackingGst] = useState(true);
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

  // Attachments State & Uploads
  const [attachments, setAttachments] = useState([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [previewModalUrl, setPreviewModalUrl] = useState(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

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

  // 2-Tier Screening States: Base Category & Subcategory
  const [selectedBaseCategory, setSelectedBaseCategory] = useState('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState('All');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [subcategorySearchQuery, setSubcategorySearchQuery] = useState('');
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');
  const [updatingAttachmentId, setUpdatingAttachmentId] = useState(null);

  // In-Grid Search & Select State
  const [activeGridSearchLineId, setActiveGridSearchLineId] = useState(null);
  const [gridSearchQuery, setGridSearchQuery] = useState('');
  const [gridSelectedBaseCategory, setGridSelectedBaseCategory] = useState('All');
  const [gridSelectedSubcategory, setGridSelectedSubcategory] = useState('All');
  const [gridCategorySearchQuery, setGridCategorySearchQuery] = useState('');
  const [gridSubcategorySearchQuery, setGridSubcategorySearchQuery] = useState('');
  const [gridPopupPos, setGridPopupPos] = useState({ top: 0, left: 0, width: 840, openAbove: false });
  const inGridSearchRef = useRef(null);

  // 1. Fetch Customers
  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const res = await api.get('/parties/customers');
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
    staleTime: 60000
  });

  // 2. Fetch Finished Products (207 items) with Real-Time Stock
  const { data: products = [], isLoading: isLoadingProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['products-catalog-sap'],
    queryFn: async () => {
      const res = await api.get('/products/search?limit=1000');
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
    staleTime: 30000,
    refetchOnWindowFocus: true
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

  // Click outside or press Escape to close in-grid search popup
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (inGridSearchRef.current && !inGridSearchRef.current.contains(e.target)) {
        setActiveGridSearchLineId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveGridSearchLineId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleOpenGridSearch = (lineId, el, initialQuery = '') => {
    setActiveGridSearchLineId(lineId);
    setGridSearchQuery(initialQuery);
    if (el) {
      const rect = el.getBoundingClientRect();
      const popupHeight = 440;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openAbove = spaceBelow < 340 && spaceAbove > spaceBelow;

      const top = openAbove
        ? Math.max(10, rect.top - popupHeight - 4)
        : Math.min(window.innerHeight - popupHeight - 10, rect.bottom + 4);

      const width = Math.min(840, window.innerWidth - 24);
      let left = rect.left;
      if (left + width > window.innerWidth - 12) {
        left = window.innerWidth - width - 12;
      }
      if (left < 12) left = 12;

      setGridPopupPos({ top, left, width, openAbove });
    }
  };

  // 2-Tier Category Hierarchy Map (Base Category -> Subcategories)
  const categoryHierarchy = useMemo(() => {
    const map = {};
    products.forEach(p => {
      const base = getProductCategory(p);
      const sub = getProductSubcategory(p);
      if (!map[base]) map[base] = new Set();
      if (sub && sub.trim() && sub !== '-') {
        map[base].add(sub.trim());
      }
    });
    return map;
  }, [products]);

  // All Base Categories
  const baseCategories = useMemo(() => {
    return ['All', ...Object.keys(categoryHierarchy).sort()];
  }, [categoryHierarchy]);

  // Filtered Base Categories for Catalog Browser Modal
  const filteredBaseCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return baseCategories;
    const q = categorySearchQuery.toLowerCase().trim();
    return baseCategories.filter(c => c === 'All' || c.toLowerCase().includes(q));
  }, [baseCategories, categorySearchQuery]);

  // Subcategories for Catalog Browser Modal
  const availableSubcategories = useMemo(() => {
    if (selectedBaseCategory === 'All') {
      return [];
    }
    const subs = categoryHierarchy[selectedBaseCategory]
      ? Array.from(categoryHierarchy[selectedBaseCategory]).sort()
      : [];
    return ['All', ...subs];
  }, [categoryHierarchy, selectedBaseCategory]);

  const screenedSubcategories = useMemo(() => {
    if (!subcategorySearchQuery.trim()) return availableSubcategories;
    const q = subcategorySearchQuery.toLowerCase().trim();
    return availableSubcategories.filter(s => s === 'All' || s.toLowerCase().includes(q));
  }, [availableSubcategories, subcategorySearchQuery]);

  const handleSelectBaseCategory = (cat) => {
    setSelectedBaseCategory(cat);
    setSelectedSubcategory('All');
    setSubcategorySearchQuery('');
  };

  // In-Grid Filtered Base Categories
  const gridFilteredBaseCategories = useMemo(() => {
    if (!gridCategorySearchQuery.trim()) return baseCategories;
    const q = gridCategorySearchQuery.toLowerCase().trim();
    return baseCategories.filter(c => c === 'All' || c.toLowerCase().includes(q));
  }, [baseCategories, gridCategorySearchQuery]);

  // In-Grid Subcategories for Selected Base Category
  const gridAvailableSubcategories = useMemo(() => {
    if (gridSelectedBaseCategory === 'All') return [];
    const subs = categoryHierarchy[gridSelectedBaseCategory]
      ? Array.from(categoryHierarchy[gridSelectedBaseCategory]).sort()
      : [];
    return ['All', ...subs];
  }, [categoryHierarchy, gridSelectedBaseCategory]);

  // In-Grid Screened Subcategories
  const gridScreenedSubcategories = useMemo(() => {
    if (!gridSubcategorySearchQuery.trim()) return gridAvailableSubcategories;
    const q = gridSubcategorySearchQuery.toLowerCase().trim();
    return gridAvailableSubcategories.filter(s => s === 'All' || s.toLowerCase().includes(q));
  }, [gridAvailableSubcategories, gridSubcategorySearchQuery]);

  const handleGridSelectBaseCategory = (cat) => {
    setGridSelectedBaseCategory(cat);
    setGridSelectedSubcategory('All');
    setGridSubcategorySearchQuery('');
  };

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

  // Line Calculations & Real-Time Stock Feasibility Checking
  const computedLines = useMemo(() => {
    return lines.map(line => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unitPrice) || 0;
      const discPct = Number(line.discountPercent) || 0;
      const gross = qty * price;
      const discAmt = gross * (discPct / 100);
      const lineTotal = Math.max(0, gross - discAmt);
      
      const liveStock = Number(line.stock !== undefined ? line.stock : (line.rawProduct ? getProductLiveStock(line.rawProduct) : 0));
      const isSufficient = line.productId ? liveStock >= qty : true;
      const deficit = line.productId ? Math.max(0, qty - liveStock) : 0;
      const allocatedFromStock = line.productId ? Math.min(qty, Math.max(0, liveStock)) : 0;

      return {
        ...line,
        stock: liveStock,
        isSufficient,
        deficit,
        allocatedFromStock,
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

  // Aggregate Stock Shortage & Deficit Breakdown
  const stockDeficitSummary = useMemo(() => {
    const shortageLines = activeLines.filter(l => !l.isSufficient);
    const totalDeficitQty = shortageLines.reduce((sum, l) => sum + l.deficit, 0);
    const totalStockAllocated = activeLines.reduce((sum, l) => sum + l.allocatedFromStock, 0);
    const allInStock = shortageLines.length === 0;

    return {
      shortageLines,
      totalDeficitQty,
      totalStockAllocated,
      allInStock,
      hasShortages: shortageLines.length > 0
    };
  }, [activeLines]);

  // Financial Summary Computations (Integrated with precise GST Engine)
  const financials = useMemo(() => {
    const totalBeforeDiscount = computedLines.reduce((sum, l) => sum + (l.lineGross || 0), 0);
    const lineDiscountTotal = computedLines.reduce((sum, l) => sum + (l.lineDiscount || 0), 0);
    const netLinesTotal = Math.max(0, totalBeforeDiscount - lineDiscountTotal);

    const docDiscAmt = Number(discountPercent) > 0 ? (netLinesTotal * (Number(discountPercent) / 100)) : 0;

    const fAmt = Number(freight) || 0;
    const lAmt = Number(loadingCharges) || 0;
    const pAmt = Number(packingCharges) || 0;
    const oAmt = Number(otherCharges) || 0;

    const targetBuyerState = placeOfSupply || (selectedCustomer?.gstin ? getStateCodeFromGstin(selectedCustomer.gstin) : null) || sellerStateCode;

    const gstCalcResult = calculateGST({
      sellerStateCode: String(sellerStateCode || '33'),
      buyerStateCode: String(targetBuyerState || '33'),
      customerGstin: selectedCustomer?.gstin || taxRegNo,
      items: activeLines.map(l => ({
        productId: l.productId,
        productName: l.itemDescription,
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        discount: Number(l.lineDiscount) || 0,
        discountPercent: Number(l.discountPercent) || 0,
        gstRate: Number(l.gstRate !== undefined ? l.gstRate : 5),
        hsnCode: l.rawProduct?.hsnCode || l.rawProduct?.specifications?.hsnCode || '21050000',
        uomName: l.unitOfSale
      })),
      charges: {
        freight: fAmt,
        freightGst: Boolean(freightGst),
        loadingCharges: lAmt,
        loadingGst: Boolean(loadingGst),
        packingCharges: pAmt,
        packingGst: Boolean(packingGst),
        insurance: 0,
        insuranceGst: false,
        otherCharges: oAmt,
        otherGst: Boolean(otherGst)
      },
      invoiceDiscount: docDiscAmt,
      tdsDeduction: 0,
      placeOfSupply: String(targetBuyerState || '33')
    });

    const grandTotal = isRoundingEnabled ? gstCalcResult.grandTotal : gstCalcResult.netAmount;
    const roundOff = isRoundingEnabled ? gstCalcResult.roundOff : 0;
    const balanceDue = Math.max(0, grandTotal - (Number(advancePaid) || 0));

    return {
      totalBeforeDiscount: round2(totalBeforeDiscount),
      lineDiscountTotal: round2(lineDiscountTotal),
      docDiscAmt: round2(docDiscAmt),
      taxableSubtotal: gstCalcResult.taxableSubtotal,
      netTaxableSubtotal: gstCalcResult.netTaxableSubtotal,
      totalChargesAmount: gstCalcResult.totalChargesAmount,
      totalTaxableCharges: gstCalcResult.totalTaxableCharges,
      effectiveTaxRate: gstCalcResult.items?.[0]?.gstRate || 5,
      cgst: gstCalcResult.cgst,
      sgst: gstCalcResult.sgst,
      igst: gstCalcResult.igst,
      totalTax: gstCalcResult.totalTax,
      rawTotal: gstCalcResult.netAmount,
      roundOff: roundOff,
      grandTotal: grandTotal,
      balanceDue: round2(balanceDue),
      amountInWords: gstCalcResult.amountInWords || numberToWordsINR(grandTotal),
      gstCalcResult
    };
  }, [
    computedLines,
    activeLines,
    discountPercent,
    freight, freightGst,
    loadingCharges, loadingGst,
    packingCharges, packingGst,
    otherCharges, otherGst,
    sellerStateCode, placeOfSupply, selectedCustomer, taxRegNo,
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
    const liveStock = getProductLiveStock(product);

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
        stock: liveStock,
        rawProduct: product
      };
    }));

    setActiveGridSearchLineId(null);

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
      text: `✔ Added "${getProductName(product)}" (${getProductSystemCode(product)}) @ ₹${price.toFixed(2)} • Live Stock: ${liveStock}`
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

  // Trigger updating an existing attachment via Camera or Gallery
  const handleTriggerUpdate = (attId, mode = 'camera') => {
    setUpdatingAttachmentId(attId);
    if (mode === 'camera') {
      cameraInputRef.current?.click();
    } else {
      galleryInputRef.current?.click();
    }
  };

  // Handle Attachment Upload (Camera or Gallery) to UPLOADS_DIR
  const handleAttachmentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setUpdatingAttachmentId(null);
      return;
    }

    setIsUploadingAttachment(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result;
        const currentOrderId = docNo || `SO_${Date.now()}`;

        try {
          const res = await api.post('/orders/upload-attachment', {
            imageData: base64Data,
            orderId: currentOrderId
          });

          if (res.data?.success && res.data?.url) {
            const itemData = {
              url: res.data.url,
              filename: res.data.filename || `order_${currentOrderId}_${Date.now()}.jpg`,
              fileSize: (file.size / 1024).toFixed(1) + ' KB',
              uploadedAt: new Date().toLocaleTimeString(),
              orderId: currentOrderId
            };

            if (updatingAttachmentId) {
              setAttachments(prev => prev.map(a => a.id === updatingAttachmentId ? { ...a, ...itemData } : a));
              setStatusMessage({
                type: 'ready',
                text: `✔ Updated attachment in @[UPLOADS_DIR]: ${itemData.filename}`
              });
              Swal.fire({
                icon: 'success',
                title: 'Attachment Updated!',
                text: `Replaced with ${itemData.filename} in @[UPLOADS_DIR]`,
                timer: 2000,
                showConfirmButton: false
              });
            } else {
              const newAttachment = {
                id: `att_${Date.now()}`,
                ...itemData
              };
              setAttachments(prev => [...prev, newAttachment]);
              setStatusMessage({
                type: 'ready',
                text: `✔ Saved image to @[UPLOADS_DIR]: ${newAttachment.filename}`
              });
              Swal.fire({
                icon: 'success',
                title: 'Attachment Saved!',
                text: `Stored as ${newAttachment.filename} in @[UPLOADS_DIR]`,
                timer: 2000,
                showConfirmButton: false
              });
            }
          }
        } catch (err) {
          console.error('Failed to upload attachment:', err);
          Swal.fire({
            icon: 'error',
            title: 'Upload Failed',
            text: err.response?.data?.error || err.message || 'Failed to save attachment to server'
          });
        } finally {
          setIsUploadingAttachment(false);
          setUpdatingAttachmentId(null);
          if (cameraInputRef.current) cameraInputRef.current.value = '';
          if (galleryInputRef.current) galleryInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsUploadingAttachment(false);
      setUpdatingAttachmentId(null);
      console.error('Error reading image file:', err);
    }
  };

  // Load existing order for editing when editOrderId is present
  useEffect(() => {
    if (!editOrderId) return;
    api.get(`/orders/${editOrderId}`).then(res => {
      const ord = res.data;
      if (!ord) return;
      setDocNo(ord.docNo || ord.referenceNo || '');
      setDocSeries(ord.documentSeries || 'Primary');
      setDocStatus(ord.status || 'Open');
      setOrderMode(ord.orderMode || (ord.status === 'Waiting for Production' ? 'NEED_PLANNING' : (ord.type === 'Quotation' ? 'QUOTATION' : 'STANDARD')));
      setCustomerId(ord.customerId || '');
      setSelectedCustomer(ord.customer || null);
      setCustomerRefNo(ord.customerRefNo || ord.referenceNo || '');
      setContactPerson(ord.customer?.contactPerson || ord.customerPhone || '');
      setShipToAddress(ord.deliveryAddress || '');
      setBillToAddress(ord.billToAddress || ord.customer?.billingAddress || '');
      setShippingMethod(ord.shippingMethod || 'Road Transport');
      setTransporterName(ord.transporterName || '');
      setVehicleNo(ord.vehicleNo || '');
      setLrNo(ord.lrNo || '');
      setEwayBillNo(ord.ewayBillNo || '');
      setPaymentTerms(ord.paymentTerms || 'Not Paid');
      setPaymentMethod(ord.paymentMode || 'Bank Transfer / NEFT');
      setAdvancePaid(Number(ord.amountPaid || 0));
      setTaxRegNo(ord.taxRegNo || ord.customer?.gstin || '');
      setPlaceOfSupply(ord.placeOfSupply || ord.buyerStateCode || '33');
      setSalesEmployee(ord.salesEmployee || '-No Sales Employee-');
      setOwner(ord.creator?.name || 'Administrator');

      // Populate Freight & Additional Logistics Charges and their GST flags
      setFreight(Number(ord.freight || 0));
      setFreightGst(ord.freightGst !== undefined ? Boolean(ord.freightGst) : true);
      setLoadingCharges(Number(ord.loadingCharges || 0));
      setLoadingGst(ord.loadingGst !== undefined ? Boolean(ord.loadingGst) : true);
      setPackingCharges(Number(ord.packingCharges || 0));
      setPackingGst(ord.packingGst !== undefined ? Boolean(ord.packingGst) : true);
      setOtherCharges(Number(ord.otherCharges || 0));
      setOtherGst(ord.otherGst !== undefined ? Boolean(ord.otherGst) : true);
      setIsRoundingEnabled(true);

      // Clean remarks & parse attachments from internalNote
      if (ord.internalNote && ord.internalNote.includes('[[ATTACHMENT:')) {
        const match = ord.internalNote.match(/\[\[ATTACHMENT:(.*?)\]\]/);
        if (match && match[1]) {
          try {
            const parsed = JSON.parse(match[1]);
            if (Array.isArray(parsed) && parsed.length > 0) setAttachments(parsed);
          } catch (e) {
            console.error('Error parsing attachments:', e);
          }
        }
      } else if (ord.attachmentUrl) {
        const urls = ord.attachmentUrl.split(',').map(u => u.trim()).filter(Boolean);
        setAttachments(urls.map((u, i) => ({
          id: `att_${Date.now()}_${i}`,
          url: u,
          filename: u.split('/').pop() || `attachment_${i + 1}.jpg`,
          fileSize: 'Uploaded',
          uploadedAt: new Date().toLocaleTimeString(),
          orderId: ord.docNo || ord.referenceNo
        })));
      }

      const cleanNote = (ord.internalNote || ord.quotationNote || '')
        .replace(/\[\[ATTACHMENT:.*?\]\]/gs, '')
        .replace(/\[Fulfillment Mode:.*?\]/g, '')
        .trim();
      setRemarks(cleanNote);

      if (ord.createdAt) {
        setPostingDate(ord.createdAt.split('T')[0]);
        setDocumentDate(ord.createdAt.split('T')[0]);
      }
      if (ord.deliveryDate) {
        setDeliveryDate(ord.deliveryDate.split('T')[0]);
      }

      // Calculate Header Discount % if stored as discountValue or discountPercent
      const grossItemsSubtotal = (ord.items || []).reduce((sum, it) => {
        const q = Number(it.quantity || 0);
        const p = Number(it.unitPrice || 0);
        const d = Number(it.discount || 0);
        return sum + Math.max(0, (q * p) - d);
      }, 0);
      const discVal = Number(ord.discountValue || ord.invoiceDiscount || 0);
      if (ord.discountPercent !== undefined && ord.discountPercent !== null && Number(ord.discountPercent) > 0) {
        setDiscountPercent(Number(ord.discountPercent));
      } else if (discVal > 0 && grossItemsSubtotal > 0) {
        setDiscountPercent(Number(((discVal / grossItemsSubtotal) * 100).toFixed(2)));
      } else {
        setDiscountPercent(0);
      }

      if (Array.isArray(ord.items) && ord.items.length > 0) {
        setLines(ord.items.map((it, idx) => {
          const itemGst = Number(it.gstRate !== undefined && it.gstRate !== null ? it.gstRate : (it.product?.gstRate || 5));
          const taxCd = itemGst === 18 ? 'SCG18' : (itemGst === 12 ? 'SCG12' : (itemGst === 28 ? 'SCG28' : 'SCG5'));
          const liveStock = it.product ? getProductLiveStock(it.product) : 0;
          const uPrice = Number(it.unitPrice || 0);
          const lineDisc = Number(it.discount || 0);
          const discPct = Number(it.discountPercent !== undefined ? it.discountPercent : (lineDisc && uPrice ? (lineDisc / uPrice) * 100 : 0));
          return {
            id: `line_${it.id || idx}`,
            rowNo: idx + 1,
            productId: it.productId,
            systemCode: it.product?.code || it.product?.systemCode || `BFD10${idx + 1}`,
            itemDescription: it.productName || it.product?.productName || it.product?.name || '',
            category: it.product?.category?.name || it.product?.category || 'Ice Cream',
            baseCategory: it.product?.baseCategory || it.product?.category?.name || 'General',
            subcategory: it.product?.subcategory?.name || it.product?.subcategory || '-',
            unitOfSale: it.uomName || it.product?.unitOfSale || it.product?.unit?.name || 'pcs',
            quantity: Number(it.quantity || 1),
            unitPrice: uPrice,
            discountPercent: discPct,
            taxCode: taxCd,
            gstRate: itemGst,
            distrRule: 'Main FG Warehouse',
            stock: liveStock,
            rawProduct: it.product
          };
        }));
      }

      setStatusMessage({
        type: 'ready',
        text: `✔ Loaded Order #${ord.docNo || ord.referenceNo} for editing. Tax and logistics amounts calculated.`
      });
    }).catch(err => console.error('Failed to load edit order', err));
  }, [editOrderId]);

  // Submit Sales Order Mutation
  const createOrderMutation = useMutation({
    mutationFn: async (payload) => {
      if (editOrderId) {
        const res = await api.put(`/orders/${editOrderId}`, payload);
        return res.data;
      }
      const res = await api.post('/orders/sales-order', payload);
      return res.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['orders']);
      queryClient.invalidateQueries(['orders-count']);

      if (editOrderId) {
        Swal.fire({
          icon: 'success',
          title: 'Order Updated Successfully',
          text: `Order #${data.docNo || docNo} has been saved to database.`,
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
        navigate(`/sales/list?id=${editOrderId}`);
        return;
      }

      const isNeedPlanning = variables?.orderMode === 'NEED_PLANNING';
      const isQuotation = variables?.orderMode === 'QUOTATION' || variables?.type === 'Quotation';

      Swal.fire({
        title: isNeedPlanning 
          ? 'Order Queued for Production!' 
          : (isQuotation ? 'Quotation Created!' : 'Sales Order Confirmed!'),
        html: `
          <div class="text-left font-sans text-sm space-y-2 p-2">
            <div class="flex justify-between border-b pb-1">
              <span class="text-slate-500">Document No:</span>
              <span class="font-bold text-slate-800">${data.docNo || docNo}</span>
            </div>
            <div class="flex justify-between border-b pb-1">
              <span class="text-slate-500">Fulfillment Mode:</span>
              <span class="font-bold ${isNeedPlanning ? 'text-amber-600' : isQuotation ? 'text-purple-600' : 'text-emerald-600'}">
                ${isNeedPlanning ? '🟠 Need Planning (Make-to-Order)' : isQuotation ? '🟣 Quotation' : '🟢 Standard Order (In-Stock Only)'}
              </span>
            </div>
            <div class="flex justify-between border-b pb-1">
              <span class="text-slate-500">Customer:</span>
              <span class="font-medium">${selectedCustomer?.name || 'Customer'}</span>
            </div>
            <div class="flex justify-between border-b pb-1">
              <span class="text-slate-500">Total Items:</span>
              <span class="font-bold">${activeLines.length} Lines</span>
            </div>
            ${isNeedPlanning ? `
              <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded p-2 text-xs text-amber-800 dark:text-amber-200 font-medium">
                ⚙️ Status: <strong>Waiting for Production</strong>. Deficit items scheduled for manufacturing work order.
              </div>
            ` : ''}
            <div class="flex justify-between pt-1">
              <span class="font-bold text-slate-700">Total Payment Due:</span>
              <span class="font-bold text-emerald-600 text-base">₹${financials.grandTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        `,
        icon: 'success',
        showCancelButton: true,
        showDenyButton: isNeedPlanning,
        confirmButtonText: '🖨️ Print Document PDF',
        denyButtonText: '⚙️ Plan Production Batch Now',
        cancelButtonText: 'Create Another Order',
        confirmButtonColor: '#f0b429',
        denyButtonColor: '#4f46e5'
      }).then((result) => {
        if (result.isConfirmed) {
          handlePrintPDF(data);
        } else if (result.isDenied && isNeedPlanning) {
          const firstDeficit = activeLines.find(l => !l.isSufficient) || activeLines[0];
          navigate(`/production/new?orderId=${data.id}&productId=${firstDeficit?.productId || ''}&quantity=${firstDeficit?.deficit || firstDeficit?.quantity || ''}`, {
            state: {
              orderId: data.id,
              productId: firstDeficit?.productId,
              quantity: firstDeficit?.deficit || firstDeficit?.quantity,
              triggerType: 'Order-Based'
            }
          });
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

    // Commercial Rule: In STANDARD mode, Customer can ONLY order if stock is available!
    if (orderMode === 'STANDARD' && stockDeficitSummary.hasShortages) {
      setStatusMessage({
        type: 'error',
        text: `✖ Cannot save Standard Order: Stock unavailable for ${stockDeficitSummary.shortageLines.map(l => l.itemDescription).join(', ')}.`
      });
      Swal.fire({
        icon: 'warning',
        title: 'Stock Unavailable for Standard Order',
        html: `
          <div class="text-left text-xs space-y-2">
            <p class="text-slate-600 dark:text-slate-300">
              In <strong>Standard Sales Order</strong> mode, you can <strong>ONLY place an order if warehouse stock is available</strong>.
            </p>
            <div class="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded p-2.5 text-rose-900 dark:text-rose-200 font-mono text-[11px] space-y-1">
              ${stockDeficitSummary.shortageLines.map(l => `<div>• <strong>${l.itemDescription}</strong> (${l.systemCode}): Ordered <strong>${l.quantity}</strong>, Available <strong>${l.stock}</strong> (Deficit: <span class="text-rose-600 font-bold">-${l.deficit} ${l.unitOfSale}</span>)</div>`).join('')}
            </div>
            <p class="text-slate-700 dark:text-slate-300 font-semibold pt-1">
              Would you like to switch to <strong>Need Planning (Make-to-Order)</strong> mode to order this deficit and schedule manufacturing production?
            </p>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: '⚙️ Switch to "Need Planning" Mode',
        cancelButtonText: 'Cancel & Adjust Quantities',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b'
      }).then(result => {
        if (result.isConfirmed) {
          setOrderMode('NEED_PLANNING');
          setStatusMessage({
            type: 'ready',
            text: '⚙ Switched to "Need Planning" (Make-to-Order) mode. You can now place this order to schedule production.'
          });
        }
      });
      return;
    }

    const isQuotation = orderMode === 'QUOTATION';
    const isNeedPlanning = orderMode === 'NEED_PLANNING';

    const payload = {
      docNo: docNo,
      documentSeries: docSeries,
      type: isQuotation ? 'Quotation' : 'Sales Order',
      orderMode: orderMode,
      status: isNeedPlanning ? 'Waiting for Production' : (isQuotation ? 'Quotation' : (docStatus === 'Open' ? 'Confirmed' : 'Quotation')),
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
      attachmentUrl: attachments.length > 0 ? attachments.map(a => a.url).join(', ') : null,
      deliveryAddress: shipToAddress,
      billToAddress: billToAddress,
      billingAddress: billToAddress,
      shippingMethod: shippingMethod,
      transporterName: transporterName,
      vehicleNo: vehicleNo,
      lrNo: lrNo,
      ewayBillNo: ewayBillNo,
      paymentTerms: paymentTerms,
      paymentMethod: paymentMethod,
      paymentMode: paymentMethod,
      amountPaid: Number(advancePaid) || 0,
      placeOfSupply: placeOfSupply,
      sellerStateCode: sellerStateCode,
      buyerStateCode: placeOfSupply,
      totalSubtotal: financials.taxableSubtotal,
      discountPercent: Number(discountPercent) || 0,
      discountValue: financials.docDiscAmt,
      invoiceDiscount: financials.docDiscAmt,
      freight: Number(freight) || 0,
      freightGst: Boolean(freightGst),
      loadingCharges: Number(loadingCharges) || 0,
      loadingGst: Boolean(loadingGst),
      packingCharges: Number(packingCharges) || 0,
      packingGst: Boolean(packingGst),
      otherCharges: Number(otherCharges) || 0,
      otherGst: Boolean(otherGst),
      collectTax: true,
      cgst: financials.cgst,
      sgst: financials.sgst,
      igst: financials.igst,
      roundOff: financials.roundOff,
      grandTotal: financials.grandTotal,
      items: activeLines.map(l => ({
        productId: l.productId,
        productName: l.itemDescription,
        hsnCode: l.rawProduct?.hsnCode || l.rawProduct?.specifications?.hsnCode || '21050000',
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discountPercent: Number(l.discountPercent) || 0,
        discount: Number(l.lineDiscount) || 0,
        gstRate: Number(l.gstRate) || 5,
        subtotal: Number(l.lineTotal),
        uomName: l.unitOfSale,
        deliveryDate: parseDMYtoYMD(deliveryDate) || new Date().toISOString().split('T')[0]
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
    setAttachments([]);
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
      const blob = generateA4TaxInvoice(orderData, storeCompany);
      const url = URL.createObjectURL(blob);
      const docName = (orderData.docNo || 'Order').replace(/[^a-zA-Z0-9_-]/g, '_');
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tax_Invoice_${docName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      console.error('Error generating PDF:', e);
      Swal.fire({
        icon: 'error',
        title: 'PDF Generation Error',
        text: e.message
      });
    }
  };

  // In-Grid Screened & Filtered Products (Base Category -> Subcategory -> Query)
  const gridFilteredProducts = useMemo(() => {
    let list = products;

    // Filter by Base Category
    if (gridSelectedBaseCategory !== 'All') {
      list = list.filter(p => getProductCategory(p) === gridSelectedBaseCategory);
    }

    // Filter by Subcategory
    if (gridSelectedSubcategory !== 'All') {
      list = list.filter(p => getProductSubcategory(p) === gridSelectedSubcategory);
    }

    // Filter by Search Query
    if (gridSearchQuery.trim()) {
      const q = gridSearchQuery.toLowerCase().trim();
      list = list.filter(p => {
        const code = getProductSystemCode(p).toLowerCase();
        const name = getProductName(p).toLowerCase();
        const cat = getProductCategory(p).toLowerCase();
        const baseCat = getProductBaseCategory(p).toLowerCase();
        const subcat = getProductSubcategory(p).toLowerCase();
        return code.includes(q) || name.includes(q) || cat.includes(q) || baseCat.includes(q) || subcat.includes(q);
      });
    }

    return list.slice(0, 60);
  }, [products, gridSearchQuery, gridSelectedBaseCategory, gridSelectedSubcategory]);

  // Filtered Catalog Items for Modal Browser (respecting 2-tier screening)
  const filteredCatalogItems = useMemo(() => {
    return products.filter(p => {
      const matchBase = selectedBaseCategory === 'All' || getProductCategory(p) === selectedBaseCategory;
      const matchSub = selectedSubcategory === 'All' || getProductSubcategory(p) === selectedSubcategory;
      const q = searchCatalogQuery.toLowerCase().trim();
      const matchQuery = !q ||
        getProductSystemCode(p).toLowerCase().includes(q) ||
        getProductName(p).toLowerCase().includes(q) ||
        getProductCategory(p).toLowerCase().includes(q) ||
        getProductBaseCategory(p).toLowerCase().includes(q) ||
        getProductSubcategory(p).toLowerCase().includes(q) ||
        (p.hsnCode && p.hsnCode.toLowerCase().includes(q));

      return matchBase && matchSub && matchQuery;
    });
  }, [products, selectedBaseCategory, selectedSubcategory, searchCatalogQuery]);

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
            onClick={() => refetchProducts()}
            className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-amber-300 text-xs rounded-xs flex items-center gap-1 font-bold"
            title="Refresh Live Stock"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Stock</span>
          </button>

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
            className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-xs flex items-center gap-1 font-medium"
            title="Reset Form"
          >
            <Plus className="w-3.5 h-3.5" />
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

      {/* COMMERCIAL SALES ORDER MODE SELECTOR */}
      <div className="w-full bg-slate-900 border-b border-slate-700 px-4 py-2.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Commercial Order Mode:</span>
          </span>
          <span className="text-[11px] text-slate-300 hidden sm:inline">
            {orderMode === 'STANDARD' && '• In-Stock Gated: Only goods currently available in inventory can be ordered'}
            {orderMode === 'NEED_PLANNING' && '• Make-to-Order: Shortages / out-of-stock items will route to Production Work Orders'}
            {orderMode === 'QUOTATION' && '• Price Quotation: Commercial proposal for customer without inventory reservation'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode 1: Standard Order (In-Stock Only) */}
          <button
            type="button"
            onClick={() => {
              setOrderMode('STANDARD');
              setStatusMessage({
                type: 'ready',
                text: '🟢 Standard Sales Order Mode: Customer can ONLY order goods that are in-stock.'
              });
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              orderMode === 'STANDARD'
                ? 'bg-emerald-500 text-slate-950 shadow-md ring-2 ring-emerald-300'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
            title="Standard Sales Order: Only in-stock goods can be ordered for dispatch"
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${orderMode === 'STANDARD' ? 'text-slate-950 font-black' : 'text-emerald-400'}`} />
            <span>Standard Order</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${orderMode === 'STANDARD' ? 'bg-slate-950/20 text-slate-950' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'}`}>
              In-Stock Only
            </span>
          </button>

          {/* Mode 2: Need Planning (Make-to-Order) */}
          <button
            type="button"
            onClick={() => {
              setOrderMode('NEED_PLANNING');
              setStatusMessage({
                type: 'ready',
                text: '🟠 Need Planning (Make-to-Order) Mode: Shortages will route to Production Planning Work Orders.'
              });
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              orderMode === 'NEED_PLANNING'
                ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-300'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
            title="Need Planning: Order deficit items and schedule manufacturing production work order"
          >
            <Clock className={`w-3.5 h-3.5 ${orderMode === 'NEED_PLANNING' ? 'text-slate-950 font-black' : 'text-amber-400'}`} />
            <span>Need Planning</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${orderMode === 'NEED_PLANNING' ? 'bg-slate-950/20 text-slate-950' : 'bg-amber-950/60 text-amber-300 border border-amber-800'}`}>
              Make-to-Order
            </span>
          </button>

          {/* Mode 3: Quotation */}
          <button
            type="button"
            onClick={() => {
              setOrderMode('QUOTATION');
              setStatusMessage({
                type: 'ready',
                text: '🟣 Quotation Mode: Commercial quotation without inventory check or stock lock.'
              });
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              orderMode === 'QUOTATION'
                ? 'bg-purple-500 text-white shadow-md ring-2 ring-purple-300'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
            title="Quotation: Commercial price estimate for customer approval"
          >
            <Sparkles className={`w-3.5 h-3.5 ${orderMode === 'QUOTATION' ? 'text-white font-black' : 'text-purple-400'}`} />
            <span>Quotation</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${orderMode === 'QUOTATION' ? 'bg-white/20 text-white' : 'bg-purple-950/60 text-purple-300 border border-purple-800'}`}>
              Price Quote
            </span>
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
              <span className={`inline-flex items-center px-2 py-0.5 rounded-xs text-[10.5px] font-bold ${
                orderMode === 'STANDARD'
                  ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : orderMode === 'NEED_PLANNING'
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-300'
              }`}>
                {orderMode === 'STANDARD' ? 'Standard Order' : (orderMode === 'NEED_PLANNING' ? 'Need Planning' : 'Quotation')}
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
            {tab.id === 'attachments' && attachments.length > 0 && (
              <span className="ml-2 px-1.5 py-0.2 bg-blue-600 text-white font-black rounded-full text-[10px]">
                {attachments.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* FULL SCREEN TAB BODY */}
      <div className="w-full p-4 bg-[var(--sap-bg-window)] flex-1 flex flex-col">
        
        {/* TAB 1: CONTENTS (Table Grid with In-Grid Search & Select) */}
        {activeTab === 'contents' && (
          <div className="w-full flex-1 flex flex-col space-y-2">
            
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
                  onClick={() => setShowCatalogModal(true)}
                  className="px-3 py-1 bg-[var(--sap-btn-sec)] hover:bg-[var(--sap-btn-sec-hover)] border border-[var(--sap-border-inner)] text-[11px] text-[var(--sap-text)] font-bold rounded-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Open full catalog browser modal"
                >
                  <Package className="w-3.5 h-3.5 text-amber-500" />
                  <span>Catalog Browser ({products.length})</span>
                </button>
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

            {/* STOCK FEASIBILITY & COMMERCIAL ORDER STATUS BANNER */}
            {activeLines.length > 0 && (
              <div className="w-full mb-2">
                {orderMode === 'STANDARD' && stockDeficitSummary.hasShortages && (
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-md p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-900 dark:text-rose-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 animate-bounce" />
                      <div>
                        <div className="font-bold text-xs flex items-center gap-1.5 flex-wrap">
                          <span>Standard Order Blocked: Stock Deficit in {stockDeficitSummary.shortageLines.length} item(s)</span>
                          <span className="bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 px-1.5 py-0.2 rounded font-mono text-[10px]">
                            Deficit: -{stockDeficitSummary.totalDeficitQty} units
                          </span>
                        </div>
                        <div className="text-[11px] text-rose-700 dark:text-rose-300">
                          In Standard Mode, customer can <strong>only order if stock is available</strong>. Please reduce ordered quantities or switch to <strong>Need Planning</strong> mode to schedule production.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOrderMode('NEED_PLANNING');
                        setStatusMessage({
                          type: 'ready',
                          text: '⚙ Switched to "Need Planning" mode. You can now order the deficit and schedule production.'
                        });
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-md shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Switch to "Need Planning" Mode</span>
                    </button>
                  </div>
                )}

                {orderMode === 'STANDARD' && !stockDeficitSummary.hasShortages && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-md p-2 flex items-center justify-between text-emerald-900 dark:text-emerald-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-xs">
                        ✓ 100% In-Stock Available: All {activeLines.length} line items have sufficient warehouse inventory. Ready for immediate confirmation and delivery note dispatch.
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-300">
                      In-Stock Verified
                    </span>
                  </div>
                )}

                {orderMode === 'NEED_PLANNING' && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-md p-2.5 flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <div className="font-bold text-xs flex items-center gap-2 flex-wrap">
                          <span>Make-to-Order Production Planning Mode Active</span>
                          <span className="bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 px-1.5 py-0.2 rounded font-mono text-[10px]">
                            Deficit to Manufacture: {stockDeficitSummary.totalDeficitQty} units
                          </span>
                          <span className="bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.2 rounded font-mono text-[10px]">
                            Warehouse Available: {stockDeficitSummary.totalStockAllocated} units
                          </span>
                        </div>
                        <div className="text-[11px] text-amber-800 dark:text-amber-300">
                          Items with shortage will be saved with status <strong>"Waiting for Production"</strong>. You can immediately launch a Production Batch Work Order upon saving.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {orderMode === 'QUOTATION' && (
                  <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 rounded-md p-2 flex items-center justify-between text-purple-900 dark:text-purple-200">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                      <span className="font-bold text-xs">
                        🟣 Commercial Quotation / Proforma Mode: This document creates a non-binding price quotation. Warehouse inventory is not locked.
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded text-purple-800 dark:text-purple-300">
                      Quotation Only
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* FULL SCREEN DOCUMENT LINE TABLE GRID WITH LIVE STOCK */}
            <div className="w-full flex-1 border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] overflow-x-auto max-h-[500px] shadow-sm relative">
              <table className="w-full min-w-[1240px] border-collapse text-[11.5px] select-text">
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
                    <th className="w-32 py-1.5 px-1 border-r border-[var(--sap-border-inner)] text-center">Stock Feasibility</th>
                    <th className="w-10 py-1.5 px-1 text-center">✕</th>
                  </tr>
                </thead>
                <tbody>
                  {computedLines.map((line, idx) => (
                    <tr
                      key={line.id}
                      className={`h-[26px] border-b border-[var(--sap-border-inner)] transition-colors ${
                        line.productId && !line.isSufficient && orderMode === 'STANDARD'
                          ? 'bg-rose-50/80 dark:bg-rose-950/40'
                          : line.productId && !line.isSufficient && orderMode === 'NEED_PLANNING'
                          ? 'bg-amber-50/70 dark:bg-amber-950/40'
                          : idx % 2 === 1 ? 'bg-[var(--sap-grid-alt)]' : 'bg-[var(--sap-input-bg)]'
                      } hover:bg-amber-50/40 dark:hover:bg-blue-950/20`}
                    >
                      {/* Row # */}
                      <td className="border-r border-[var(--sap-border-inner)] text-center text-[var(--sap-text-muted)] font-mono text-[11px]">
                        {line.rowNo}
                      </td>

                      {/* System Code with Orange Drill-down */}
                      <td className="border-r border-[var(--sap-border-inner)] p-0">
                        <div className="flex items-center h-full px-1">
                          <input
                            type="text"
                            value={line.systemCode}
                            placeholder="BFD101..."
                            onChange={(e) => {
                              handleLineChange(line.id, 'systemCode', e.target.value);
                              handleOpenGridSearch(line.id, e.target, e.target.value);
                            }}
                            onClick={(e) => handleOpenGridSearch(line.id, e.target, line.systemCode || '')}
                            onFocus={(e) => handleOpenGridSearch(line.id, e.target, line.systemCode || '')}
                            className="flex-1 h-full px-1 bg-transparent border-0 outline-none font-mono font-bold text-[11px] text-[var(--sap-text)] placeholder:text-slate-400 placeholder:font-normal"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenGridSearch(line.id, e.currentTarget.parentElement, line.systemCode || '');
                            }}
                            className="px-1 text-slate-400 hover:text-amber-600 cursor-pointer text-[10px]"
                            title="Search and select product in grid"
                          >
                            🔍
                          </button>
                          {line.productId && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setStockQueryProductId(line.productId);
                                setIsStockQueryOpen(true);
                              }}
                              className="w-5 h-full text-[var(--sap-drilldown)] font-extrabold text-[12px] flex items-center justify-center shrink-0 hover:scale-125 cursor-pointer"
                              title="Drill-down into live batches"
                            >
                              ➔
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Product Name * */}
                      <td className="border-r border-[var(--sap-border-inner)] p-0">
                        <div className="flex items-center h-full px-1">
                          <input
                            type="text"
                            value={line.itemDescription}
                            placeholder="Product Name..."
                            onChange={(e) => {
                              handleLineChange(line.id, 'itemDescription', e.target.value);
                              handleOpenGridSearch(line.id, e.target, e.target.value);
                            }}
                            onClick={(e) => handleOpenGridSearch(line.id, e.target, line.itemDescription || '')}
                            onFocus={(e) => handleOpenGridSearch(line.id, e.target, line.itemDescription || '')}
                            className="flex-1 h-full px-1 bg-transparent border-0 outline-none font-semibold text-[11.5px] text-[var(--sap-text)] placeholder:text-slate-400 placeholder:font-normal"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenGridSearch(line.id, e.currentTarget.parentElement, line.itemDescription || '');
                            }}
                            className="px-1 text-slate-400 hover:text-amber-600 cursor-pointer text-[10px]"
                            title="Search and select product in grid"
                          >
                            ▾
                          </button>
                        </div>
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
                          className="w-full h-full px-1.5 bg-transparent border-0 outline-none text-[11px] font-medium text-[var(--sap-text)] cursor-pointer"
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

                      {/* Stock Feasibility & Status Display */}
                      <td className="border-r border-[var(--sap-border-inner)] text-center px-1 text-[10.5px]">
                        {line.productId ? (
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            {line.isSufficient ? (
                              <span className="px-2 py-0.5 rounded-xs font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span>✓ {line.stock} in stock</span>
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-xs font-mono font-bold flex items-center gap-1 ${
                                orderMode === 'STANDARD'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                              }`}>
                                <span>⚠️ -{line.deficit} Deficit</span>
                                <span className="opacity-75 font-normal text-[9.5px]">({line.stock})</span>
                              </span>
                            )}
                            {orderMode === 'NEED_PLANNING' && !line.isSufficient && (
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold">
                                Produce: {line.deficit} {line.unitOfSale}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
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

              {/* FLOATING IN-GRID SEARCH & SELECT PANEL */}
              {activeGridSearchLineId && (
                <div
                  ref={inGridSearchRef}
                  style={{
                    position: 'fixed',
                    top: `${gridPopupPos.top}px`,
                    left: `${gridPopupPos.left}px`,
                    width: `${gridPopupPos.width}px`,
                    zIndex: 9999,
                    maxHeight: '440px'
                  }}
                  className="bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-500 shadow-2xl rounded-sm flex flex-col overflow-hidden text-xs animate-in fade-in duration-100"
                >
                  {/* Header */}
                  <div className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between select-none">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-bold text-xs">
                        Select Product for Row #{lines.find(l => l.id === activeGridSearchLineId)?.rowNo || 1}
                      </span>
                      <span className="text-[10px] text-amber-300 font-mono bg-slate-700/80 px-1.5 py-0.2 rounded-xs">
                        {gridFilteredProducts.length} items
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveGridSearchLineId(null)}
                      className="text-slate-400 hover:text-white font-bold text-sm px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Search Input Bar */}
                  <div className="p-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                    <div className="relative flex-1 flex items-center">
                      <Search className="w-3.5 h-3.5 text-amber-500 absolute left-2.5 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        value={gridSearchQuery}
                        onChange={(e) => setGridSearchQuery(e.target.value)}
                        placeholder="Search System Code (e.g. BFD101, BG306), Product Name (e.g. Butterscotch), Category..."
                        className="w-full pl-8 pr-7 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xs text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
                      />
                      {gridSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setGridSearchQuery('')}
                          className="absolute right-2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2-Tier Screening in Grid: Base Category -> Subcategory */}
                  <div className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 space-y-1.5">
                    {/* Level 1: Base Category Selector */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
                      <div className="relative shrink-0 flex items-center">
                        <Search className="w-3 h-3 text-slate-400 absolute left-1.5" />
                        <input
                          type="text"
                          value={gridCategorySearchQuery}
                          onChange={(e) => setGridCategorySearchQuery(e.target.value)}
                          placeholder="Search Base Category..."
                          className="w-36 h-[20px] pl-5 pr-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xs text-[10px] outline-none focus:border-amber-500"
                        />
                      </div>
                      <span className="text-[9.5px] font-bold uppercase text-slate-500 shrink-0">
                        Base Category:
                      </span>
                      {gridFilteredBaseCategories.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => handleGridSelectBaseCategory(cat)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 cursor-pointer transition-colors ${
                            gridSelectedBaseCategory === cat
                              ? 'bg-amber-500 text-slate-950 shadow-xs'
                              : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Level 2: Subcategories (ONLY for the selected Base Category) */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-200/60 dark:border-slate-700/60 scrollbar-thin">
                      <span className="text-[9.5px] font-bold uppercase text-indigo-600 dark:text-indigo-400 shrink-0">
                        Subcategory:
                      </span>
                      {gridSelectedBaseCategory === 'All' ? (
                        <span className="text-[10px] text-slate-500 italic">
                          👉 Click any Base Category above to screen subcategories (e.g. Family Pack ➔ Family Pack 700ML)
                        </span>
                      ) : (
                        <>
                          <div className="relative shrink-0 flex items-center">
                            <input
                              type="text"
                              value={gridSubcategorySearchQuery}
                              onChange={(e) => setGridSubcategorySearchQuery(e.target.value)}
                              placeholder={`Screen ${gridSelectedBaseCategory} subcategories...`}
                              className="w-40 h-[19px] px-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xs text-[9.5px] outline-none focus:border-indigo-500"
                            />
                          </div>
                          {gridScreenedSubcategories.map(sub => (
                            <button
                              key={sub}
                              type="button"
                              onClick={() => setGridSelectedSubcategory(sub)}
                              className={`px-2 py-0.2 rounded-full text-[9.5px] font-semibold shrink-0 cursor-pointer transition-colors ${
                                gridSelectedSubcategory === sub
                                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-indigo-50'
                              }`}
                            >
                              {sub === 'All' ? `All (${gridSelectedBaseCategory})` : sub}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Products Table Grid in Popup */}
                  <div className="flex-1 overflow-y-auto max-h-[250px] divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="grid grid-cols-12 gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                      <div className="col-span-2">System Code *</div>
                      <div className="col-span-3">Product Name *</div>
                      <div className="col-span-2">Category *</div>
                      <div className="col-span-2">Base / Subcategory</div>
                      <div className="col-span-1 text-center">Unit *</div>
                      <div className="col-span-1 text-right">Sale Price *</div>
                      <div className="col-span-1 text-center">Stock</div>
                    </div>

                    {gridFilteredProducts.map(p => {
                      const sysCode = getProductSystemCode(p);
                      const pName = getProductName(p);
                      const cat = getProductCategory(p);
                      const baseCat = getProductBaseCategory(p);
                      const subcat = getProductSubcategory(p);
                      const unitOfSale = getProductUnitOfSale(p);
                      const price = getProductSalePrice(p);
                      const liveStock = getProductLiveStock(p);

                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            handleSelectProductForLine(activeGridSearchLineId, p);
                            setActiveGridSearchLineId(null);
                          }}
                          className="grid grid-cols-12 gap-1.5 px-3 py-1.5 hover:bg-amber-50 dark:hover:bg-slate-800 cursor-pointer items-center transition-colors group text-[11px]"
                        >
                          <div className="col-span-2 font-mono font-bold text-amber-700 dark:text-amber-400 truncate">
                            {sysCode}
                          </div>
                          <div className="col-span-3 font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors truncate">
                            {pName}
                          </div>
                          <div className="col-span-2 text-slate-600 dark:text-slate-300 font-medium truncate text-[10.5px]">
                            {cat}
                          </div>
                          <div className="col-span-2 text-slate-500 text-[10px] truncate">
                            {baseCat} {subcat && subcat !== '-' ? `• ${subcat}` : ''}
                          </div>
                          <div className="col-span-1 text-center text-slate-700 dark:text-slate-300 font-medium">
                            {unitOfSale}
                          </div>
                          <div className="col-span-1 text-right font-bold text-slate-900 dark:text-white">
                            ₹{price.toFixed(0)}
                          </div>
                          <div className="col-span-1 text-center">
                            <span className={`px-1.5 py-0.2 rounded-xs font-mono font-bold text-[9.5px] inline-flex items-center gap-1 ${
                              liveStock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${liveStock > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                              {liveStock}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {gridFilteredProducts.length === 0 && (
                      <div className="p-6 text-center text-slate-400">
                        No product found matching "{gridSearchQuery}" in {gridSelectedBaseCategory}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span>Click any row to select into grid • Esc to close</span>
                    <button
                      type="button"
                      onClick={() => setActiveGridSearchLineId(null)}
                      className="text-amber-600 font-bold hover:underline cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
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
                          onChange={(e) => setPackingGst(e.target.checked)}
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
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div>
                  <div className="text-[11px] text-[var(--sap-text-muted)] font-bold">Taxable Goods</div>
                  <div className="font-mono font-bold text-sm text-[var(--sap-text)]">
                    ₹{financials.taxableSubtotal.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--sap-text-muted)] font-bold">Logistics Charges</div>
                  <div className="font-mono font-bold text-sm text-[var(--sap-text)]">
                    ₹{(financials.totalChargesAmount || 0).toFixed(2)}
                  </div>
                </div>
                {!isInterState ? (
                  <>
                    <div>
                      <div className="text-[11px] text-[var(--sap-text-muted)] font-bold">CGST Tax</div>
                      <div className="font-mono font-bold text-sm text-[var(--sap-text)]">
                        ₹{financials.cgst.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[var(--sap-text-muted)] font-bold">SGST Tax</div>
                      <div className="font-mono font-bold text-sm text-[var(--sap-text)]">
                        ₹{financials.sgst.toFixed(2)}
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="text-[11px] text-[var(--sap-text-muted)] font-bold">IGST Tax</div>
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

        {/* TAB 5: ATTACHMENTS (Camera Capture, Gallery Upload, Saved in UPLOADS_DIR with Order ID) */}
        {activeTab === 'attachments' && (
          <div className="w-full space-y-4 text-[11.5px]">
            
            {/* Upload Action Bar */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-[var(--sap-border-inner)] rounded-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-amber-500" />
                    <span>Order Document Attachments & Proof Photos</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Images are saved directly to server directory <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">@[UPLOADS_DIR]</span> prefixed with Order ID (<span className="font-mono font-bold text-amber-600">{docNo || 'SO_ORDER'}</span>).
                  </p>
                </div>

                {/* Dual Upload Triggers: Camera & Gallery */}
                <div className="flex items-center gap-2">
                  
                  {/* Camera Input */}
                  <input
                    type="file"
                    ref={cameraInputRef}
                    accept="image/*"
                    capture="environment"
                    onChange={handleAttachmentUpload}
                    className="hidden"
                    id="camera-photo-input"
                  />
                  <button
                    type="button"
                    disabled={isUploadingAttachment}
                    onClick={() => cameraInputRef.current?.click()}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{isUploadingAttachment ? 'Uploading...' : 'Take Camera Photo'}</span>
                  </button>

                  {/* Gallery Input */}
                  <input
                    type="file"
                    ref={galleryInputRef}
                    accept="image/*,application/pdf"
                    onChange={handleAttachmentUpload}
                    className="hidden"
                    id="gallery-file-input"
                  />
                  <button
                    type="button"
                    disabled={isUploadingAttachment}
                    onClick={() => galleryInputRef.current?.click()}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    <span>{isUploadingAttachment ? 'Uploading...' : 'Upload from Gallery'}</span>
                  </button>
                </div>
              </div>

              {/* Uploaded Attachments Grid / List */}
              {attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                  {attachments.map(att => (
                    <div
                      key={att.id}
                      className="p-2.5 border border-slate-200 dark:border-slate-800 rounded-sm bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between space-y-2 group shadow-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          onClick={() => setPreviewModalUrl(att.url)}
                          className="w-16 h-16 rounded-xs bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600 cursor-pointer relative group-hover:opacity-90"
                        >
                          <img
                            src={att.url}
                            alt={att.filename}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="100%" height="100%" fill="%23cbd5e1"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="10" fill="%23475569">Doc</text></svg>';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 truncate" title={att.filename}>
                            {att.filename}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Order ID: <span className="font-bold text-amber-600">{att.orderId}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {att.fileSize} • {att.uploadedAt}
                          </div>
                          <span className="inline-block mt-1 px-1.5 py-0.2 rounded-xs text-[9.5px] font-bold bg-emerald-100 text-emerald-800">
                            Saved in UPLOADS_DIR
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleTriggerUpdate(att.id, 'camera')}
                          className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xs text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer"
                          title="Retake camera photo to update this attachment"
                        >
                          <Camera className="w-3 h-3 text-amber-700" />
                          <span>Update Photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTriggerUpdate(att.id, 'gallery')}
                          className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-xs text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer"
                          title="Replace with an image from device gallery"
                        >
                          <ImageIcon className="w-3 h-3 text-slate-600" />
                          <span>Update Gallery</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewModalUrl(att.url)}
                          className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-xs text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                        <a
                          href={att.url}
                          download={att.filename}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-xs text-[10.5px] font-semibold flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Save</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachments(prev => prev.filter(a => a.id !== att.id));
                          }}
                          className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xs text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-sm bg-slate-50/50 dark:bg-slate-950/20">
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <div className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                    No attachments uploaded yet for this Sales Order
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                    Click <strong>Take Camera Photo</strong> to snap delivery/PO slip on mobile, or <strong>Upload from Gallery</strong> to attach invoice docs.
                  </p>
                </div>
              )}
            </div>

            {/* Remarks / Dispatch Instructions */}
            <div className="p-3 bg-white dark:bg-slate-900 border border-[var(--sap-border-inner)] rounded-sm space-y-1.5">
              <label className="block text-[var(--sap-text-muted)] font-bold text-xs">
                Sales Order Remarks & Dispatch Notes
              </label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter dispatch notes, production priority, terms, or customer special requests..."
                className="w-full p-2 text-[11.5px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
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
              value={`₹${financials.totalBeforeDiscount.toFixed(2)} INR`}
              className="w-48 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
            />
          </div>

          {/* Discount Amount */}
          <div className="flex items-center justify-end w-full max-w-[420px] gap-1">
            <label className="text-[var(--sap-text-muted)] font-semibold pr-2 text-right">Discount Amount</label>
            <div className="flex items-center gap-0.5">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                className="w-16 h-[24px] px-1 text-right font-mono font-bold border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                title="Discount Percentage (%)"
              />
              <span className="text-[var(--sap-text-muted)] text-[11px] font-bold">%</span>
            </div>
            <input
              type="text"
              readOnly
              value={`-₹${financials.docDiscAmt.toFixed(2)} INR`}
              className="w-28 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-rose-600 dark:text-rose-400 outline-none"
            />
          </div>

          {/* Freight & Logistics Charges */}
          <div className="flex items-center justify-end w-full max-w-[420px]">
            <label className="text-[var(--sap-text-muted)] font-semibold pr-3 text-right">Freight & Logistics Charges</label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('tax')}
                className="text-amber-600 font-extrabold hover:scale-125 cursor-pointer text-sm"
                title="Configure Freight, Loading, Packing in Tax Tab"
              >
                ➔
              </button>
              <input
                type="text"
                readOnly
                value={`₹${(financials.totalChargesAmount || 0).toFixed(2)} INR`}
                className="w-48 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
              />
            </div>
          </div>

          {/* Taxable Subtotal */}
          <div className="flex items-center justify-end w-full max-w-[420px]">
            <label className="text-[var(--sap-text-muted)] font-semibold pr-3 text-right">Taxable Subtotal</label>
            <input
              type="text"
              readOnly
              value={`₹${(financials.taxableSubtotal || 0).toFixed(2)} INR`}
              className="w-48 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
            />
          </div>

          {/* GST Taxes (CGST+SGST / IGST) */}
          <div className="flex items-center justify-end w-full max-w-[420px]">
            <label className="text-[var(--sap-text-muted)] font-semibold pr-3 text-right">GST Taxes (CGST+SGST / IGST)</label>
            <input
              type="text"
              readOnly
              value={`₹${(financials.totalTax || 0).toFixed(2)} INR`}
              className="w-48 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-amber-600 dark:text-amber-400 outline-none"
            />
          </div>

          {/* Round-Off Adjustment (PO Order Round-off Style) */}
          <div className="flex items-center justify-end w-full max-w-[420px] gap-2">
            <label className="flex items-center gap-1.5 text-[var(--sap-text-muted)] font-bold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRoundingEnabled}
                onChange={(e) => setIsRoundingEnabled(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span>Round-Off Adjustment</span>
            </label>
            <input
              type="text"
              readOnly
              value={`₹${financials.roundOff.toFixed(2)} INR`}
              className="w-48 h-[24px] px-2 text-right font-mono font-bold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
            />
          </div>

          {/* Net Grand Total */}
          <div className="flex items-center justify-end w-full max-w-[420px] pt-1">
            <label className="text-[var(--sap-text)] font-extrabold pr-3 text-right text-xs">
              Net Grand Total
            </label>
            <input
              type="text"
              readOnly
              value={`₹${financials.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR`}
              className="w-48 h-[26px] px-2 text-right font-mono font-black text-sm border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-emerald-700 dark:text-emerald-400 outline-none"
            />
          </div>

          {/* Advance Paid & Balance Due */}
          <div className="flex items-center justify-between w-full max-w-[420px] text-xs pt-1 px-1 text-slate-600 dark:text-slate-400">
            <span>Advance Paid: <strong className="font-mono text-slate-800 dark:text-white">₹{(Number(advancePaid) || 0).toFixed(2)}</strong></span>
            <span>Balance Due: <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">₹{(financials.balanceDue || 0).toFixed(2)}</strong></span>
          </div>

          {/* Amount in Words */}
          <div className="text-[10.5px] text-slate-500 font-semibold italic max-w-[420px] text-right truncate">
            {financials.amountInWords}
          </div>
        </div>
      </div>

      {/* FULL SCREEN BOTTOM ACTIONS BAR (Golden Yellow Add/Update Button, Cancel, PDF Print, Copy From/To) */}
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
                <span>{editOrderId ? 'Updating Order...' : 'Adding Order...'}</span>
              </>
            ) : editOrderId ? (
              <span>Update Order</span>
            ) : orderMode === 'STANDARD' ? (
              <span>Add Standard Order</span>
            ) : orderMode === 'NEED_PLANNING' ? (
              <span>Submit for Production Planning</span>
            ) : (
              <span>Create Quotation</span>
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

      {/* FULL PRODUCT CATALOG BROWSER MODAL (207 Items - 2-Tier Screening with Table & Cards Views) */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl rounded-sm w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-xs">
            
            {/* Modal Header */}
            <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between select-none">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Package className="w-4 h-4 text-amber-400" />
                <span>Finished Product Catalog (207 Items)</span>
                <span className="text-xs font-normal text-slate-300 opacity-80 pl-2 border-l border-slate-600">
                  Live Stock • 2-Tier Category Screening
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-700 rounded-xs p-0.5 border border-slate-600">
                  <button
                    type="button"
                    onClick={() => setCatalogViewMode('table')}
                    className={`px-2.5 py-0.5 rounded-xs flex items-center gap-1 text-[11px] font-semibold ${
                      catalogViewMode === 'table' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Table className="w-3 h-3" />
                    <span>Table View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogViewMode('cards')}
                    className={`px-2.5 py-0.5 rounded-xs flex items-center gap-1 text-[11px] font-semibold ${
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

            {/* Search & 2-Tier Category Screening */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchCatalogQuery}
                  onChange={(e) => setSearchCatalogQuery(e.target.value)}
                  placeholder="Search by System Code (e.g. BFD101, P141), Product Name (e.g. Vanilla), Category, Subcategory..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xs text-xs font-medium outline-none focus:border-amber-500"
                />
              </div>

              {/* 2-Tier Filtering: Base Category -> Subcategory Pills */}
              <div className="space-y-1.5 pt-1">
                {/* Level 1: Base Category with Search Filter */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <div className="relative shrink-0 flex items-center">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2" />
                    <input
                      type="text"
                      value={categorySearchQuery}
                      onChange={(e) => setCategorySearchQuery(e.target.value)}
                      placeholder="Search Base Category..."
                      className="w-36 h-[22px] pl-6 pr-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xs text-[10.5px] outline-none focus:border-amber-500"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Base Category:</span>
                  {filteredBaseCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleSelectBaseCategory(cat)}
                      className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold shrink-0 cursor-pointer transition-colors ${
                        selectedBaseCategory === cat
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Level 2: Subcategories for selected Base Category only */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase shrink-0">
                    Subcategory:
                  </span>
                  {selectedBaseCategory === 'All' ? (
                    <span className="text-[10.5px] text-slate-500 italic">
                      👉 Click any Base Category above to screen and display its subcategories only
                    </span>
                  ) : (
                    <>
                      <div className="relative shrink-0 flex items-center">
                        <input
                          type="text"
                          value={subcategorySearchQuery}
                          onChange={(e) => setSubcategorySearchQuery(e.target.value)}
                          placeholder={`Screen ${selectedBaseCategory} subcategories...`}
                          className="w-44 h-[20px] px-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xs text-[10px] outline-none focus:border-indigo-500"
                        />
                      </div>
                      {screenedSubcategories.map(sub => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setSelectedSubcategory(sub)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 cursor-pointer transition-colors ${
                            selectedSubcategory === sub
                              ? 'bg-indigo-600 text-white shadow-xs font-bold'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-50'
                          }`}
                        >
                          {sub === 'All' ? `All (${selectedBaseCategory})` : sub}
                        </button>
                      ))}
                    </>
                  )}
                </div>
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
                      <th className="py-2 px-2 text-center w-24">Live Stock</th>
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
                      const liveStock = getProductLiveStock(p);
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
                            <span className={`px-2 py-0.5 rounded-xs font-mono font-bold flex items-center justify-center gap-1 ${
                              liveStock > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600 border border-slate-300'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${liveStock > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                              <span>{liveStock}</span>
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
                    const liveStock = getProductLiveStock(p);
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
                            <span className={`px-2 py-0.5 rounded-xs font-mono font-bold flex items-center gap-1 ${
                              liveStock > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600 border border-slate-300'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${liveStock > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                              <span>Stock: {liveStock}</span>
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

      {/* FULL PREVIEW MODAL FOR ATTACHMENT IMAGES */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-sm overflow-hidden p-2 flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewModalUrl(null)}
              className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black text-white rounded-full z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewModalUrl}
              alt="Attachment Full Preview"
              className="max-h-[80vh] max-w-full object-contain"
            />
            <div className="pt-2 flex items-center gap-3">
              <a
                href={previewModalUrl}
                download="order_attachment.jpg"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Attachment</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewModalUrl(null)}
                className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xs"
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
