import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/axios';
import {
  FileText, Plus, Trash2, Printer, Check, X,
  AlertTriangle, ArrowRight, Building2, Calendar, Truck, DollarSign, Percent,
  ChevronDown, ChevronUp, RefreshCw, Search, ArrowLeft, ShieldAlert,
  Sparkles, Layers, Receipt, Clock, CheckCircle2, Download, Tag, UserPlus, Eye,
  GitFork, CheckCheck, Lock,
  Package, Boxes, CreditCard, Banknote, HelpCircle, ShieldCheck, Info,
  SlidersHorizontal, CheckSquare, Square, MapPin, Globe, Moon, Sun,
  ExternalLink, ChevronRight, Minimize2, Maximize2, LayoutGrid, Table,
  Camera, Image as ImageIcon, Paperclip, UploadCloud,
  Mail, Send, Share2, MessageSquare, TrendingUp,
  Landmark, Wallet, FileSpreadsheet, Copy, Calculator
} from 'lucide-react';
import SearchSelect from '@/components/ui/SearchSelect';
import QuickAddCustomerModal from '@/components/forms/QuickAddCustomerModal';
import ProductStockQueryModal from '@/modules/production/components/ProductStockQueryModal';
import RMLotAllocationModal from '@/modules/sales/components/RMLotAllocationModal';
import DocumentFlowModal from '@/modules/sales/components/DocumentFlowModal';
import { calculateGST, numberToWordsINR, getIndianStates, getStateCodeFromGstin, round2, computeOrderGstSlabs } from '@/utils/gstEngine';
import { generateA4TaxInvoice, getSalesDocumentPdfFilename } from '@/utils/salesPdfGenerator';
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

// Optimized Product Search Index Builder (Pre-computed for instant 0ms multi-field searching)
const createProductSearchIndex = (p) => {
  const code = (getProductSystemCode(p) || '').toLowerCase();
  const name = (getProductName(p) || '').toLowerCase();
  const cat = (getProductCategory(p) || '').toLowerCase();
  const baseCat = (getProductBaseCategory(p) || '').toLowerCase();
  const subcat = (getProductSubcategory(p) || '').toLowerCase();
  const cleanSubcat = subcat === '-' ? '' : subcat;
  const hsn = (p?.hsnCode || '').toLowerCase();
  const unit = (getProductUnitOfSale(p) || '').toLowerCase();

  // Strip non-alphanumeric characters for space-agnostic & punctuation-agnostic search
  const codeCompact = code.replace(/[^a-z0-9]/g, '');
  const nameCompact = name.replace(/[^a-z0-9]/g, '');
  const catCompact = cat.replace(/[^a-z0-9]/g, '');
  const baseCatCompact = baseCat.replace(/[^a-z0-9]/g, '');
  const subcatCompact = cleanSubcat.replace(/[^a-z0-9]/g, '');
  const hsnCompact = hsn.replace(/[^a-z0-9]/g, '');
  const unitCompact = unit.replace(/[^a-z0-9]/g, '');

  // Combined text with spaces for token / phrase matching across any field
  const combined = `${code} ${name} ${cat} ${baseCat} ${cleanSubcat} ${hsn} ${unit}`.trim();

  // Combined compact strings for space-less cross-field matching (e.g. "kulfistickalmond")
  const combinedCompact = `${codeCompact}${nameCompact}${catCompact}${baseCatCompact}${subcatCompact}${hsnCompact}`;
  const combinedCompactAlt = `${catCompact}${baseCatCompact}${subcatCompact}${nameCompact}${codeCompact}`;

  return {
    code,
    name,
    cat,
    baseCat,
    subcat: cleanSubcat,
    hsn,
    unit,
    codeCompact,
    nameCompact,
    catCompact,
    baseCatCompact,
    subcatCompact,
    hsnCompact,
    unitCompact,
    combined,
    combinedCompact,
    combinedCompactAlt
  };
};

// Ultra-fast Multi-Field, Space-Agnostic, Tokenized Matcher
const matchProductSearch = (index, query) => {
  if (!query) return { matched: true, score: 0 };

  const rawQ = query.trim().toLowerCase();
  if (!rawQ) return { matched: true, score: 0 };

  const compactQ = rawQ.replace(/[^a-z0-9]/g, '');

  // 1. Direct exact system code match (e.g. "K123" === "k123")
  if (index.code === rawQ || (compactQ && index.codeCompact === compactQ)) {
    return { matched: true, score: 1000 };
  }

  // 2. System code starts with query (e.g. "K12" -> "K123")
  if (index.code.startsWith(rawQ) || (compactQ && index.codeCompact.startsWith(compactQ))) {
    return { matched: true, score: 900 };
  }

  // 3. Exact product name match (e.g. "Almond Pista" or "almondpista")
  if (index.name === rawQ || (compactQ && index.nameCompact === compactQ)) {
    return { matched: true, score: 850 };
  }

  // 4. Product name starts with query
  if (index.name.startsWith(rawQ) || (compactQ && index.nameCompact.startsWith(compactQ))) {
    return { matched: true, score: 750 };
  }

  // 5. Exact category or subcategory match (e.g. "Kulfi Stick" or "kulfistick")
  if (index.cat === rawQ || (compactQ && index.catCompact === compactQ)) {
    return { matched: true, score: 700 };
  }
  if (index.subcat && (index.subcat === rawQ || (compactQ && index.subcatCompact === compactQ))) {
    return { matched: true, score: 680 };
  }

  // 6. Category or subcategory starts with query
  if (index.cat.startsWith(rawQ) || (compactQ && index.catCompact.startsWith(compactQ))) {
    return { matched: true, score: 650 };
  }
  if (index.subcat && (index.subcat.startsWith(rawQ) || (compactQ && index.subcatCompact.startsWith(compactQ)))) {
    return { matched: true, score: 630 };
  }

  // 7. System code contains query anywhere
  if (index.code.includes(rawQ) || (compactQ && index.codeCompact.includes(compactQ))) {
    return { matched: true, score: 600 };
  }

  // 8. Product name contains query anywhere
  if (index.name.includes(rawQ) || (compactQ && index.nameCompact.includes(compactQ))) {
    return { matched: true, score: 580 };
  }

  // 9. Combined raw phrase match
  if (index.combined.includes(rawQ)) {
    return { matched: true, score: 550 };
  }

  // 10. Space-less full query match across any field or concatenated fields
  // (handles "kulfistick", "almondpista", "familypack700ml", "fruitblend", etc.)
  if (compactQ && (
    index.combinedCompact.includes(compactQ) ||
    index.combinedCompactAlt.includes(compactQ) ||
    index.catCompact.includes(compactQ) ||
    index.baseCatCompact.includes(compactQ) ||
    index.subcatCompact.includes(compactQ) ||
    index.nameCompact.includes(compactQ) ||
    index.hsnCompact.includes(compactQ)
  )) {
    return { matched: true, score: 500 };
  }

  // 11. Multi-term / Combined search across multiple fields
  // (e.g. "kulfi almond", "k123 almond", "kulfi assorted", "kulfistick almondpista")
  const tokens = rawQ.split(/[\s,+/•\-]+/).filter(Boolean);
  if (tokens.length > 1) {
    let allTokensMatch = true;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const tokenCompact = token.replace(/[^a-z0-9]/g, '');

      const tokenMatched =
        index.combined.includes(token) ||
        (tokenCompact && (
          index.combinedCompact.includes(tokenCompact) ||
          index.codeCompact.includes(tokenCompact) ||
          index.nameCompact.includes(tokenCompact) ||
          index.catCompact.includes(tokenCompact) ||
          index.baseCatCompact.includes(tokenCompact) ||
          index.subcatCompact.includes(tokenCompact) ||
          index.hsnCompact.includes(tokenCompact) ||
          index.unitCompact.includes(tokenCompact)
        ));

      if (!tokenMatched) {
        allTokensMatch = false;
        break;
      }
    }

    if (allTokensMatch) {
      return { matched: true, score: 450 };
    }
  }

  return { matched: false, score: 0 };
};

// Indian State name helper (from 2-digit GST code)
const getIndianStateName = (code) => {
  if (!code) return 'Tamil Nadu';
  const cleanCode = String(code).padStart(2, '0');
  const match = getIndianStates().find(s => s.code === cleanCode);
  return match ? match.name : `State (${cleanCode})`;
};

// Helper to convert ancillary charge tax codes when supply type changes
const mapTaxCodeForSupplyType = (code, toInterState) => {
  if (!code || code === 'EXEMPT') return 'EXEMPT';
  if (toInterState) {
    return code.replace(/^SCG/, 'IGST');
  } else {
    return code.replace(/^IGST/, 'SCG');
  }
};

// Helper to synchronize line item tax codes when supply type changes (Intra-State vs Inter-State)
const updateLinesTaxCodesForSupplyType = (currentLines, toInterState) => {
  return currentLines.map(l => {
    let newCode = l.taxCode;
    const rate = Number(l.gstRate) || 5;
    if (toInterState) {
      if (rate === 28) newCode = 'IGST28';
      else if (rate === 18) newCode = 'IGST18';
      else if (rate === 12) newCode = 'IGST12';
      else if (rate === 9) newCode = 'IGST9';
      else if (rate === 0) newCode = 'EXEMPT';
      else newCode = 'IGST5';
    } else {
      if (rate === 28) newCode = 'SCG28';
      else if (rate === 18) newCode = 'SCG18';
      else if (rate === 12) newCode = 'SCG12';
      else if (rate === 9) newCode = 'SCG9';
      else if (rate === 0) newCode = 'EXEMPT';
      else newCode = 'SCG5';
    }
    return { ...l, taxCode: newCode };
  });
};

// Create empty document line
const createEmptyLine = (index = 1, isInter = false) => ({
  id: `line_${Date.now()}_${Math.random()}`,
  rowNo: index,
  itemType: 'PRODUCT', // 'PRODUCT' | 'RAW_MATERIAL'
  productId: '',
  rawMaterialId: null,
  systemCode: '',
  itemDescription: '',
  category: '',
  baseCategory: '',
  subcategory: '',
  unitOfSale: 'pcs',
  quantity: 1,
  unitPrice: 0,
  discountPercent: 0,
  taxCode: isInter ? 'IGST5' : 'SCG5',
  gstRate: 5,
  distrRule: 'Main FG Warehouse',
  stock: 0,
  rawProduct: null,
  rawMaterial: null,
  isPackingCharge: false,
  batchAllocations: []
});

// Full-Coverage Excel-like Column Widths for Document Rows Table (Fully covers screen start to end)
const DEFAULT_SAP_DOC_COL_WIDTHS = {
  rowNo: 38,
  itemType: 115,
  systemCode: 135,
  productName: 240, // Generous width ensuring placeholder, title & search icon fit perfectly
  category: 120,
  subcategory: 135,
  uom: 85,          // Fits "Unit of Sale *" without truncating
  packing: 65,      // Fits "Packing?" without truncating
  quantity: 75,
  salePrice: 115,   // Fits "Sale Price (INR) *" without truncating
  discount: 80,     // Fits "Discount %" without truncating
  taxCode: 105,     // Fits "Tax Code" cleanly
  total: 110,       // Fits "Total (LC)" cleanly
  inStock: 75,
  remainingStock: 105, // Fits "Remaining Stock" without truncating
  reserved: 75,
  stockCheck: 135,  // Fits "Stock Check / Shortfall" without truncating
  actions: 36
};

// Safe Minimum Widths to Prevent Broken / Illegible Slivers
const MIN_SAP_DOC_COL_WIDTHS = {
  rowNo: 28,
  itemType: 95,
  systemCode: 110,
  productName: 175,
  category: 80,
  subcategory: 85,
  uom: 55,
  packing: 45,
  quantity: 55,
  salePrice: 75,
  discount: 55,
  taxCode: 80,
  total: 80,
  inStock: 60,
  remainingStock: 70,
  reserved: 60,
  stockCheck: 95,
  actions: 30
};

const STORAGE_KEY_COL_WIDTHS = 'sap_order_studio_col_widths_v5';

export default function SalesOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editOrderId = searchParams.get('id') || searchParams.get('edit');
  const convertFromId = searchParams.get('convertFrom') || searchParams.get('sourceId');
  const modeParam = searchParams.get('mode')?.toUpperCase();
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [loadedOrderData, setLoadedOrderData] = useState(null);
  const [showDocFlowModal, setShowDocFlowModal] = useState(false);
  const currentUser = useAuthStore(s => s.user);
  const storeCompany = useCompanyStore(s => s.company);
  const fetchCompany = useCompanyStore(s => s.fetchCompany);
  const queryClient = useQueryClient();

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  // Excel-like Column Resizing & Persistence State (with Full-Coverage Clamping)
  const [colWidths, setColWidths] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COL_WIDTHS);
      if (saved) {
        const parsed = JSON.parse(saved);
        const validated = { ...DEFAULT_SAP_DOC_COL_WIDTHS };
        Object.keys(DEFAULT_SAP_DOC_COL_WIDTHS).forEach(key => {
          const val = Number(parsed[key]);
          const minW = MIN_SAP_DOC_COL_WIDTHS[key] || 35;
          if (!isNaN(val) && val > 0) {
            validated[key] = Math.max(minW, val);
          }
        });
        return validated;
      }
    } catch (e) {
      console.error('Failed to parse saved column widths', e);
    }
    return DEFAULT_SAP_DOC_COL_WIDTHS;
  });

  const [resizingCol, setResizingCol] = useState(null);
  const resizingColRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COL_WIDTHS, JSON.stringify(colWidths));
    } catch (e) {}
  }, [colWidths]);

  const handleResizeMouseDown = useCallback((colKey, e) => {
    e.preventDefault();
    e.stopPropagation();

    const targetCol = colKey;
    const startX = e.clientX;
    const thEl = e.currentTarget.closest('th');
    const startWidth = thEl ? thEl.getBoundingClientRect().width : (colWidths[targetCol] || DEFAULT_SAP_DOC_COL_WIDTHS[targetCol] || 100);
    resizingColRef.current = { colKey: targetCol, startX, startWidth };
    setResizingCol(targetCol);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent) => {
      const active = resizingColRef.current;
      if (!active) return;
      const deltaX = moveEvent.clientX - active.startX;
      const minW = MIN_SAP_DOC_COL_WIDTHS[targetCol] || 35;
      const newWidth = Math.max(minW, Math.min(900, Math.round(active.startWidth + deltaX)));

      setColWidths(prev => ({
        ...prev,
        [targetCol]: newWidth
      }));
    };

    const onMouseUp = () => {
      resizingColRef.current = null;
      setResizingCol(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [colWidths]);

  const handleResetColWidths = useCallback(() => {
    setColWidths(DEFAULT_SAP_DOC_COL_WIDTHS);
    try {
      localStorage.removeItem(STORAGE_KEY_COL_WIDTHS);
      localStorage.removeItem('sap_order_studio_col_widths_v4');
      localStorage.removeItem('sap_order_studio_col_widths_v3');
      localStorage.removeItem('sap_order_studio_col_widths_v2');
      localStorage.removeItem('sap_order_studio_col_widths');
    } catch (e) {}
  }, []);

  const handleColDoubleClick = useCallback((colKey) => {
    setColWidths(prev => ({
      ...prev,
      [colKey]: DEFAULT_SAP_DOC_COL_WIDTHS[colKey]
    }));
  }, []);

  const totalTableWidth = useMemo(() => {
    return Object.values(colWidths).reduce((sum, w) => sum + (Number(w) || 0), 0);
  }, [colWidths]);

  const renderTh = (colKey, label, align = 'left', tooltip = null) => {
    const width = colWidths[colKey] || DEFAULT_SAP_DOC_COL_WIDTHS[colKey];
    const isResizingThis = resizingCol === colKey;
    const isLastCol = colKey === 'actions';

    return (
      <th
        key={colKey}
        style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
        className={`relative py-1 px-1.5 ${!isLastCol ? 'border-r border-[var(--sap-border-inner)]' : ''} select-none group/th overflow-hidden`}
        title={tooltip || label}
      >
        <div className={`truncate flex items-center ${align === 'center' ? 'justify-center' : (align === 'right' ? 'justify-end' : 'justify-start')} w-full pr-0.5 font-bold text-[10.5px]`}>
          <span className="truncate">{label}</span>
        </div>
        {!isLastCol && (
          <div
            onMouseDown={(e) => handleResizeMouseDown(colKey, e)}
            onDoubleClick={() => handleColDoubleClick(colKey)}
            title="Drag border to resize column • Double-click to reset"
            className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-amber-500/80 active:bg-amber-600 transition-all z-20 flex items-center justify-center ${
              isResizingThis ? 'bg-amber-500 opacity-100' : 'opacity-0 group-hover/th:opacity-100'
            }`}
          >
            <div className="w-[1px] h-3 bg-amber-700/80 dark:bg-amber-300/80 rounded-full" />
          </div>
        )}
      </th>
    );
  };

  // Converted Source Order Tracking
  const [sourceOrderId, setSourceOrderId] = useState(convertFromId || null);
  const [sourceDocNo, setSourceDocNo] = useState('');

  // Active Tab: 'contents' | 'logistics' | 'accounting' | 'tax' | 'attachments'
  const [activeTab, setActiveTab] = useState('contents');

  // Enterprise Sales Fulfillment Modes: 'QUOTATION' (Price Quote, 0 Stock Effect) | 'STANDARD' (Commitment & Stock Reservation, Back-Orders Allowed) | 'INVOICE' (Atomic Stock Deduction at Posting)
  const [orderMode, setOrderMode] = useState(
    modeParam === 'INVOICE' || convertFromId ? 'INVOICE' : (modeParam === 'QUOTATION' ? 'QUOTATION' : 'STANDARD')
  );

  // Converted Quotation lifecycle detection
  const isConvertedQuote = orderMode === 'QUOTATION' && (
    loadedOrderData?.status === 'Converted' ||
    loadedOrderData?.isConvertedQuote ||
    (loadedOrderData?.childOrders && loadedOrderData.childOrders.length > 0)
  );
  const convertedChildOrder = loadedOrderData?.childOrders?.[0] || loadedOrderData?.convertedToOrder || loadedOrderData?.documentChain?.find(d => d.type === 'Sales Order');

  // Converted Sales Order lifecycle detection (Sales Order converted into Tax Invoice)
  const isInvoicedOrder = orderMode === 'STANDARD' && (
    loadedOrderData?.status === 'Delivered' ||
    loadedOrderData?.isInvoicedOrder ||
    (loadedOrderData?.childOrders && loadedOrderData.childOrders.some(c => c.type === 'Invoice' || c.orderType === 'Invoice')) ||
    (loadedOrderData?.documentChain && loadedOrderData.documentChain.some(d => d.type === 'Invoice' && d.id !== editOrderId))
  );
  const invoiceChildOrder = loadedOrderData?.childOrders?.find(c => c.type === 'Invoice' || c.orderType === 'Invoice') ||
    loadedOrderData?.invoicedToOrder ||
    loadedOrderData?.documentChain?.find(d => d.type === 'Invoice' && d.id !== editOrderId);

  // Overall Document Immutability Guard: Converted Quotations and Invoiced Sales Orders are 100% locked
  const isDocumentLocked = isConvertedQuote || isInvoicedOrder;
  const lockedReason = isConvertedQuote
    ? `Quotation #${docNo || loadedOrderData?.docNo || ''} has already been converted to Sales Order #${convertedChildOrder?.docNo || 'SO'} and cannot be edited, changed, or deleted.`
    : isInvoicedOrder
      ? `Sales Order #${docNo || loadedOrderData?.docNo || ''} has already been converted to Tax Invoice #${invoiceChildOrder?.docNo || 'INV'} and cannot be edited, changed, or deleted. Only downstream Tax Invoices can be modified.`
      : '';

  // Customer & Header Details
  const [customerId, setCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerRefNo, setCustomerRefNo] = useState('');
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
  const [discountAmountInput, setDiscountAmountInput] = useState(0);
  const [discountMode, setDiscountMode] = useState('percent'); // 'percent' | 'amount'
  const [isRoundingEnabled, setIsRoundingEnabled] = useState(true);

  // Additional Charges & Tax Ledger
  const [freight, setFreight] = useState(0);
  const [freightPercent, setFreightPercent] = useState(0);
  const [freightTaxCode, setFreightTaxCode] = useState('SCG18');
  const [loadingCharges, setLoadingCharges] = useState(0);
  const [loadingPercent, setLoadingPercent] = useState(0);
  const [loadingTaxCode, setLoadingTaxCode] = useState('EXEMPT');
  const [packingCharges, setPackingCharges] = useState(0);
  const [packingPercent, setPackingPercent] = useState(0);
  const [packingTaxCode, setPackingTaxCode] = useState('EXEMPT');
  const [otherCharges, setOtherCharges] = useState(0);
  const [otherPercent, setOtherPercent] = useState(0);
  const [otherTaxCode, setOtherTaxCode] = useState('EXEMPT');

  // Dynamic Payment Method Details (Persisted per Order)
  const [bankTransferDetails, setBankTransferDetails] = useState({
    bankName: '',
    accountNo: '',
    ifsc: '',
    branch: '',
    transactionRef: ''
  });
  const [upiDetails, setUpiDetails] = useState({
    upiId: '',
    mobileNo: '',
    utrRef: ''
  });
  const [cardDetails, setCardDetails] = useState({
    cardLast4: '',
    cardNetwork: 'Visa / RuPay',
    terminalCode: ''
  });
  const [cashDetails, setCashDetails] = useState({
    cashReceived: 0,
    cashierNote: ''
  });
  const [chequeDetails, setChequeDetails] = useState({
    chequeNo: '',
    bankName: '',
    chequeDate: '',
    clearanceStatus: 'Pending'
  });

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard?.writeText(String(text));
    setStatusMessage({
      type: 'ready',
      text: `✔ Copied ${label || 'text'} to clipboard: ${text}`
    });
  };

  // Statutory Terms & Conditions Text Area (Editable per Order, printed on PDF)
  const [orderTerms, setOrderTerms] = useState(
    '1. Goods once sold will not be taken back without valid QC inspection.\n2. Interest @ 18% p.a. will be charged if payment is delayed beyond due date.\n3. Subject to Salem jurisdiction only.'
  );

  const getTaxRateFromCode = (code) => {
    if (!code || code === 'EXEMPT') return 0;
    if (code === 'SCG28' || code === 'IGST28') return 28;
    if (code === 'SCG18' || code === 'IGST18') return 18;
    if (code === 'SCG12' || code === 'IGST12') return 12;
    if (code === 'SCG9'  || code === 'IGST9')  return 9;
    if (code === 'SCG5'  || code === 'IGST5')  return 5;
    const match = String(code).match(/\d+/);
    if (match) return Number(match[0]);
    return 0; // EXEMPT
  };

  const getChargeBadgeText = (code) => {
    const rate = getTaxRateFromCode(code);
    if (rate <= 0) return 'Exempt (0%)';
    if (isInterState) return `${rate}% IGST`;
    const half = Math.round((rate / 2) * 100) / 100;
    return `CGST ${half}% + SGST ${half}%`;
  };

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

  // Tax Tab Fields & Tax Supply Type
  const [taxRegNo, setTaxRegNo] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('33'); // Default Tamil Nadu (33)
  const [manualSupplyType, setManualSupplyType] = useState(null); // null | 'INTRA_STATE' | 'INTER_STATE'

  // Attachments State & Uploads
  const [attachments, setAttachments] = useState([]);
  const [removedAttachmentUrls, setRemovedAttachmentUrls] = useState([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [previewModalUrl, setPreviewModalUrl] = useState(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Helper to get fully qualified attachment URL (proxied or direct backend)
  const getFullAttachmentUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
    return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
  };

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

  // Raw Material Resale & Packing Lot Allocation States
  const [activeRMLotLine, setActiveRMLotLine] = useState(null);
  const [isRMLotModalOpen, setIsRMLotModalOpen] = useState(false);
  const [catalogScope, setCatalogScope] = useState('PRODUCTS'); // 'PRODUCTS' | 'RAW_MATERIALS'
  const [gridSearchScope, setGridSearchScope] = useState('PRODUCTS'); // 'PRODUCTS' | 'RAW_MATERIALS'

  // Stock Synchronization State & Feedback
  const [isSyncingStock, setIsSyncingStock] = useState(false);
  const [lastStockSyncTime, setLastStockSyncTime] = useState(null);

  // Fullscreen Studio Mode State
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullScreen = () => {
    if (!isFullscreen) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

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

  // Fast Lookup Map for Real-Time Product Stock & Attributes
  const productMap = useMemo(() => {
    const map = new Map();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  // 2b. Fetch Raw Materials for Resale & Packing Items
  const { data: rawMaterials = [], isLoading: isLoadingRM, refetch: refetchRM } = useQuery({
    queryKey: ['rm-stock-sales'],
    queryFn: async () => {
      const res = await api.get('/rm-stock');
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
    staleTime: 30000,
    refetchOnWindowFocus: true
  });

  // Fast Lookup Map for Real-Time Raw Material Stock & Attributes
  const rmMap = useMemo(() => {
    const map = new Map();
    rawMaterials.forEach(rm => map.set(rm.id, rm));
    return map;
  }, [rawMaterials]);

  // Synchronize existing line items with fresh rawMaterials and products when data loads
  useEffect(() => {
    if (rawMaterials.length === 0 && products.length === 0) return;
    setLines(prev => prev.map(line => {
      if (!line.productId && !line.rawMaterialId && !line.itemDescription) return line;

      // An item is a Raw Material ONLY if explicitly set or strictly a raw material ID with no product
      const isRM = line.itemType === 'RAW_MATERIAL'
        || (Boolean(line.rawMaterialId) && !line.productId && !line.rawProduct)
        || (Boolean(line.rawMaterial) && !line.productId && !line.rawProduct);

      if (isRM) {
        const rmId = line.rawMaterialId || (line.productId && rmMap.has(line.productId) && !productMap.has(line.productId) ? line.productId : null);
        const rm = (rmId ? rmMap.get(rmId) : null)
          || line.rawMaterial;

        if (rm) {
          const freshStock = Number(rm.currentStock !== undefined ? rm.currentStock : (rm.availableQuantity !== undefined ? rm.availableQuantity : (rm.stock || 0)));
          return {
            ...line,
            itemType: 'RAW_MATERIAL',
            rawMaterialId: rm.id,
            productId: null,
            rawMaterial: rm,
            rawProduct: null,
            systemCode: line.systemCode || rm.code || rm.sku || 'RM',
            itemDescription: line.itemDescription || rm.printName || rm.name,
            category: line.category || rm.category?.name || rm.category || 'Packing Items',
            baseCategory: line.baseCategory || 'Raw Material',
            unitOfSale: line.unitOfSale || rm.unitId || 'kg',
            stock: freshStock,
            onHand: freshStock
          };
        }
      } else {
        const prodId = line.productId;
        const prod = (prodId ? productMap.get(prodId) : null)
          || line.rawProduct
          || (line.systemCode ? Array.from(productMap.values()).find(p => p.code?.toLowerCase() === line.systemCode?.toLowerCase()) : null)
          || Array.from(productMap.values()).find(p => p.name?.toLowerCase() === line.itemDescription?.toLowerCase());

        if (prod) {
          const freshStock = getProductLiveStock(prod);
          return {
            ...line,
            itemType: 'PRODUCT',
            productId: prod.id,
            rawMaterialId: null,
            rawProduct: prod,
            rawMaterial: null,
            systemCode: line.systemCode || prod.code || prod.systemCode,
            itemDescription: line.itemDescription || prod.name || prod.productName,
            category: line.category || prod.category?.name || prod.category || 'Finished Goods',
            baseCategory: line.baseCategory || prod.baseCategory || prod.subcategory?.name || 'General',
            subcategory: line.subcategory || prod.subcategory?.name || prod.subcategory || '-',
            unitOfSale: line.unitOfSale || prod.unit?.name || prod.unitOfSale || 'pcs',
            stock: freshStock,
            onHand: freshStock
          };
        }
      }
      return line;
    }));
  }, [rawMaterials, products, rmMap, productMap]);

  // Synchronize Live Warehouse Inventory with Real-Time Feedback
  const handleSyncStock = async () => {
    try {
      setIsSyncingStock(true);
      setStatusMessage({
        type: 'info',
        text: '🔄 Synchronizing live warehouse stock with database...'
      });

      const [resProd, resRM] = await Promise.all([
        refetchProducts(),
        refetchRM()
      ]);
      const freshList = Array.isArray(resProd.data) ? resProd.data : (resProd.data?.data || []);
      const freshRMList = Array.isArray(resRM.data) ? resRM.data : (resRM.data?.data || []);

      await queryClient.invalidateQueries({ queryKey: ['products-catalog-sap'] });
      await queryClient.invalidateQueries({ queryKey: ['products-search-list'] });
      await queryClient.invalidateQueries({ queryKey: ['rm-stock-sales'] });

      // Synchronize existing lines with updated warehouse stock
      setLines(prev => prev.map(line => {
        if (line.productId) {
          const freshItem = freshList.find(p => p.id === line.productId);
          if (freshItem) {
            return {
              ...line,
              stock: getProductLiveStock(freshItem),
              rawProduct: freshItem
            };
          }
        } else if (line.rawMaterialId) {
          const freshRM = freshRMList.find(r => r.id === line.rawMaterialId);
          if (freshRM) {
            return {
              ...line,
              stock: Number(freshRM.currentStock !== undefined ? freshRM.currentStock : (freshRM.availableQuantity !== undefined ? freshRM.availableQuantity : 0)),
              rawMaterial: freshRM
            };
          }
        }
        return line;
      }));

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastStockSyncTime(timeStr);

      setStatusMessage({
        type: 'ready',
        text: `✔ Stock Synchronized at ${timeStr} • Live inventory updated across ${freshList.length} products & ${freshRMList.length} raw materials.`
      });

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Stock Synchronized (${freshList.length} FG + ${freshRMList.length} RM)`,
        text: `Live stock updated at ${timeStr}`,
        showConfirmButton: false,
        timer: 2200,
        timerProgressBar: true
      });
    } catch (err) {
      console.error('Stock sync error:', err);
      setStatusMessage({
        type: 'error',
        text: '✖ Failed to synchronize stock with database.'
      });
    } finally {
      setIsSyncingStock(false);
    }
  };

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

  // Prefix mapper based on Commercial Order Fulfillment Mode:
  // 'STANDARD' -> SO, 'INVOICE' -> INV, 'QUOTATION' -> QT
  const getPrefixForMode = useCallback((mode) => {
    switch (mode) {
      case 'INVOICE': return 'INV';
      case 'QUOTATION': return 'QT';
      case 'STANDARD':
      default: return 'SO';
    }
  }, []);

  // Fetch Next Document Number dynamically based on active order mode
  // Note: For Invoices, consecutive GST series is assigned strictly at posting to prevent gaps.
  const fetchNextDocNo = useCallback((mode) => {
    if (editOrderId) return;
    if (mode === 'INVOICE') {
      setDocNo('Assigned on posting');
      return;
    }
    const prefix = getPrefixForMode(mode);
    api.get('/orders/next-invoice-number', { params: { prefix } })
      .then(res => {
        if (res.data?.receiptNumber) {
          setDocNo(res.data.receiptNumber);
        }
      })
      .catch(() => {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const count = ordersData?.total || (Array.isArray(ordersData?.data) ? ordersData.data.length : 0);
        const seq = String(count + 1).padStart(4, '0');
        setDocNo(`${prefix}/26-27/${month}/${seq}`);
      });
  }, [editOrderId, getPrefixForMode, ordersData]);

  // Synchronize Document Number whenever order mode changes
  useEffect(() => {
    if (!editOrderId) {
      fetchNextDocNo(orderMode);
    }
  }, [orderMode, fetchNextDocNo, editOrderId]);

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
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
      }
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullScreen();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  const handleOpenGridSearch = (lineId, el, initialQuery = '') => {
    setActiveGridSearchLineId(lineId);
    setGridSearchQuery(initialQuery);
    const targetLine = lines.find(l => l.id === lineId);
    if (targetLine) {
      if (targetLine.rawMaterialId || targetLine.itemType === 'RAW_MATERIAL') {
        setGridSearchScope('RAW_MATERIALS');
      } else {
        setGridSearchScope('PRODUCTS');
      }
    }
    setGridSelectedBaseCategory('All');
    setGridSelectedSubcategory('All');
    setGridCategorySearchQuery('');
    setGridSubcategorySearchQuery('');
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
    const qCompact = q.replace(/[^a-z0-9]/g, '');
    return baseCategories.filter(c => {
      if (c === 'All') return true;
      const cLower = c.toLowerCase();
      const cCompact = cLower.replace(/[^a-z0-9]/g, '');
      return cLower.includes(q) || (qCompact && cCompact.includes(qCompact));
    });
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
    const qCompact = q.replace(/[^a-z0-9]/g, '');
    return availableSubcategories.filter(s => {
      if (s === 'All') return true;
      const sLower = s.toLowerCase();
      const sCompact = sLower.replace(/[^a-z0-9]/g, '');
      return sLower.includes(q) || (qCompact && sCompact.includes(qCompact));
    });
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
    const qCompact = q.replace(/[^a-z0-9]/g, '');
    return baseCategories.filter(c => {
      if (c === 'All') return true;
      const cLower = c.toLowerCase();
      const cCompact = cLower.replace(/[^a-z0-9]/g, '');
      return cLower.includes(q) || (qCompact && cCompact.includes(qCompact));
    });
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
    const qCompact = q.replace(/[^a-z0-9]/g, '');
    return gridAvailableSubcategories.filter(s => {
      if (s === 'All') return true;
      const sLower = s.toLowerCase();
      const sCompact = sLower.replace(/[^a-z0-9]/g, '');
      return sLower.includes(q) || (qCompact && sCompact.includes(qCompact));
    });
  }, [gridAvailableSubcategories, gridSubcategorySearchQuery]);

  const handleGridSelectBaseCategory = (cat) => {
    setGridSelectedBaseCategory(cat);
    setGridSelectedSubcategory('All');
    setGridSubcategorySearchQuery('');
  };

  // Determine Supplier State Code from Company GSTIN (first 2 digits)
  const supplierGstin = storeCompany?.companyGstin || storeCompany?.gstin || storeCompany?.taxRegNo || '33XXXXXXXXXXXXXX';
  const supplierStateCode = getStateCodeFromGstin(supplierGstin) || storeCompany?.stateCode || '33';
  const sellerStateCode = supplierStateCode;

  // Determine Customer State Code from Customer GSTIN (first 2 digits)
  const customerGstin = (taxRegNo || selectedCustomer?.gstin || '').trim();
  const customerStateCode = getStateCodeFromGstin(customerGstin);
  const hasCustomerGstin = Boolean(customerStateCode);

  // If GST is available: CANNOT CHANGE, auto-applied based on supplierStateCode !== customerStateCode
  // If GST is NOT available: can change manually using manualSupplyType (defaults to INTRA_STATE)
  const isInterState = hasCustomerGstin
    ? String(supplierStateCode) !== String(customerStateCode)
    : (manualSupplyType ? manualSupplyType === 'INTER_STATE' : String(sellerStateCode) !== String(placeOfSupply));

  // Toggle or select Tax Supply Type manually (ONLY available if Customer GSTIN is NOT present)
  const handleTaxSupplyTypeChange = (newType) => {
    if (hasCustomerGstin) {
      // Locked: Cannot change if customer GSTIN is available
      return;
    }
    setManualSupplyType(newType);
    const toInter = newType === 'INTER_STATE';
    if (toInter) {
      if (String(placeOfSupply) === String(sellerStateCode)) {
        setPlaceOfSupply(sellerStateCode === '33' ? '29' : '33');
      }
    } else {
      setPlaceOfSupply(sellerStateCode);
    }
    setLines(prev => updateLinesTaxCodesForSupplyType(prev, toInter));
    setFreightTaxCode(prev => mapTaxCodeForSupplyType(prev, toInter));
    setPackingTaxCode(prev => mapTaxCodeForSupplyType(prev, toInter));
    setLoadingTaxCode(prev => mapTaxCodeForSupplyType(prev, toInter));
    setOtherTaxCode(prev => mapTaxCodeForSupplyType(prev, toInter));
  };

  // Handle GSTIN Input change with automatic state code extraction & tax rule update
  const handleGstinInputChange = (newGstin) => {
    const upper = newGstin.toUpperCase().trim();
    setTaxRegNo(upper);
    const custState = getStateCodeFromGstin(upper);
    if (custState) {
      setPlaceOfSupply(custState);
      const autoInter = String(sellerStateCode) !== String(custState);
      setManualSupplyType(null); // Strictly locked to GST rule
      setLines(prev => updateLinesTaxCodesForSupplyType(prev, autoInter));
      setFreightTaxCode(prev => mapTaxCodeForSupplyType(prev, autoInter));
      setPackingTaxCode(prev => mapTaxCodeForSupplyType(prev, autoInter));
      setLoadingTaxCode(prev => mapTaxCodeForSupplyType(prev, autoInter));
      setOtherTaxCode(prev => mapTaxCodeForSupplyType(prev, autoInter));
      setStatusMessage({
        type: 'info',
        text: `✔ GSTIN entered: ${upper} (${getIndianStateName(custState)}) ➔ 🔒 ${autoInter ? 'Inter-State IGST' : 'Intra-State CGST+SGST'} Auto-Applied & Locked`
      });
    } else {
      setManualSupplyType('INTRA_STATE');
      setPlaceOfSupply(sellerStateCode);
      setLines(prev => updateLinesTaxCodesForSupplyType(prev, false));
      setFreightTaxCode(prev => mapTaxCodeForSupplyType(prev, false));
      setPackingTaxCode(prev => mapTaxCodeForSupplyType(prev, false));
      setLoadingTaxCode(prev => mapTaxCodeForSupplyType(prev, false));
      setOtherTaxCode(prev => mapTaxCodeForSupplyType(prev, false));
    }
  };

  // Handle Place of Supply select dropdown change (Available when no GSTIN or manual)
  const handlePlaceOfSupplyChange = (newPlace) => {
    if (hasCustomerGstin) return; // Locked by GSTIN
    setPlaceOfSupply(newPlace);
    const autoInter = String(sellerStateCode) !== String(newPlace);
    setManualSupplyType(autoInter ? 'INTER_STATE' : 'INTRA_STATE');
    setLines(prev => updateLinesTaxCodesForSupplyType(prev, autoInter));
    setFreightTaxCode(prev => mapTaxCodeForSupplyType(prev, autoInter));
    setPackingTaxCode(prev => mapTaxCodeForSupplyType(prev, autoInter));
    setLoadingTaxCode(prev => mapTaxCodeForSupplyType(prev, autoInter));
    setOtherTaxCode(prev => mapTaxCodeForSupplyType(prev, autoInter));
  };

  // Handle Customer Selection
  const handleCustomerChange = (cid) => {
    if (isDocumentLocked) return;
    setCustomerId(cid);
    const cust = customers.find(c => c.id === cid);
    if (cust) {
      setSelectedCustomer(cust);
      setContactPerson(cust.contactPerson || cust.phone || '');
      setShipToAddress(cust.shippingAddress || cust.address || '');
      setBillToAddress(cust.billingAddress || cust.address || '');
      const cGstin = cust.gstin || cust.taxRegNo || '';
      setTaxRegNo(cGstin);
      if (cust.paymentTerms) setPaymentTerms(cust.paymentTerms);

      const custState = getStateCodeFromGstin(cGstin);
      if (custState) {
        setPlaceOfSupply(custState);
        const autoInter = String(sellerStateCode) !== String(custState);
        setManualSupplyType(null); // Locked to GSTIN rule
        setLines(prev => updateLinesTaxCodesForSupplyType(prev, autoInter));
        setFreightTaxCode(prev => mapTaxCodeForSupplyType(prev, autoInter));
        setPackingTaxCode(prev => mapTaxCodeForSupplyType(prev, autoInter));
        setLoadingTaxCode(prev => mapTaxCodeForSupplyType(prev, autoInter));
        setOtherTaxCode(prev => mapTaxCodeForSupplyType(prev, autoInter));
        setStatusMessage({
          type: 'info',
          text: `✔ Customer selected: ${cust.name} (GSTIN: ${cGstin} • ${getIndianStateName(custState)} (${custState}) ➔ 🔒 ${autoInter ? 'Inter-State IGST' : 'Intra-State CGST+SGST'} Auto-Applied & Locked)`
        });
      } else {
        setManualSupplyType('INTRA_STATE');
        setPlaceOfSupply(sellerStateCode);
        setLines(prev => updateLinesTaxCodesForSupplyType(prev, false));
        setFreightTaxCode(prev => mapTaxCodeForSupplyType(prev, false));
        setPackingTaxCode(prev => mapTaxCodeForSupplyType(prev, false));
        setLoadingTaxCode(prev => mapTaxCodeForSupplyType(prev, false));
        setOtherTaxCode(prev => mapTaxCodeForSupplyType(prev, false));
        setStatusMessage({
          type: 'info',
          text: `✔ Customer selected: ${cust.name} (Unregistered / No GSTIN • Can manually toggle CGST+SGST / IGST)`
        });
      }
    } else {
      setSelectedCustomer(null);
      setContactPerson('');
      setShipToAddress('');
      setBillToAddress('');
      setTaxRegNo('');
      setManualSupplyType(null);
      setPlaceOfSupply(sellerStateCode);
      setLines(prev => updateLinesTaxCodesForSupplyType(prev, false));
    }
  };

  // Line Calculations & Real-Time Stock Feasibility Checking (Dynamic productMap lookup)
  const computedLines = useMemo(() => {
    return lines.map(line => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unitPrice) || 0;
      const discPct = Number(line.discountPercent) || 0;
      const gross = qty * price;
      const discAmt = gross * (discPct / 100);
      const lineTotal = Math.max(0, gross - discAmt);
      
      const isRM = line.itemType === 'RAW_MATERIAL' || (Boolean(line.rawMaterialId) && !line.productId);
      const matchedProd = line.productId ? productMap.get(line.productId) : null;
      const matchedRM = line.rawMaterialId ? rmMap.get(line.rawMaterialId) : null;
      const onHand = isRM
        ? (matchedRM
            ? Number(matchedRM.currentStock !== undefined ? matchedRM.currentStock : (matchedRM.availableQuantity !== undefined ? matchedRM.availableQuantity : (matchedRM.stock || 0)))
            : Number(line.stock !== undefined ? line.stock : (line.rawMaterial?.currentStock || 0)))
        : (matchedProd 
            ? getProductLiveStock(matchedProd) 
            : Number(line.stock !== undefined ? line.stock : (line.rawProduct ? getProductLiveStock(line.rawProduct) : 0)));
      const freeStock = isRM
        ? onHand
        : Math.max(0, onHand - Number(matchedProd?.totalReserved || 0));
      
      const lineReserved = Number(line.sourceReservedQty || 0);
      const availableForInvoice = freeStock + lineReserved;

      // When quantity is entered: display remaining stock
      const remainingStock = Math.max(0, (isRM ? onHand : freeStock) - qty);

      let reservedQty = 0;
      let shortfallQty = 0;
      let isSufficient = true;

      if (isRM) {
        // Raw Materials are purchased/resale items; they NEVER go to production
        reservedQty = Math.min(qty, freeStock);
        shortfallQty = 0;
        isSufficient = true;
      } else if (orderMode === 'QUOTATION') {
        reservedQty = 0;
        shortfallQty = 0;
        isSufficient = true;
      } else if (orderMode === 'INVOICE') {
        // If converted from an order, order's own reservation is available for this invoice
        reservedQty = Math.min(qty, availableForInvoice);
        shortfallQty = Math.max(0, qty - availableForInvoice);
        isSufficient = availableForInvoice >= qty;
      } else {
        // Standard Order for finished products
        reservedQty = Math.min(qty, freeStock);
        shortfallQty = Math.max(0, qty - reservedQty);
        isSufficient = freeStock >= qty;
      }

      const deficit = shortfallQty;
      const allocatedFromStock = reservedQty;

      return {
        ...line,
        stock: onHand,
        onHand,
        inStock: onHand,
        freeStock,
        remainingStock,
        reservedQty,
        shortfallQty,
        isSufficient,
        deficit,
        allocatedFromStock,
        lineGross: gross,
        lineDiscount: discAmt,
        lineTotal: lineTotal
      };
    });
  }, [lines, productMap, rmMap, orderMode]);

  // Active (Non-Empty) Lines (Finished Products or Raw Materials)
  const activeLines = useMemo(() => {
    return computedLines.filter(l => (l.productId || l.rawMaterialId) && l.quantity > 0);
  }, [computedLines]);

  // Total Packing Lines Value (When user marks lines as packing charges)
  const packingItemsSum = useMemo(() => {
    return activeLines
      .filter(l => l.isPackingCharge)
      .reduce((sum, l) => sum + (l.lineTotal || 0), 0);
  }, [activeLines]);

  // Total Quantity across all document rows
  const totalDocumentQuantity = useMemo(() => {
    return activeLines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
  }, [activeLines]);

  // Aggregate Stock Shortage & Deficit Breakdown (Only Manufactured Products go to production)
  const stockDeficitSummary = useMemo(() => {
    const productLines = activeLines.filter(l => !l.rawMaterialId && l.itemType !== 'RAW_MATERIAL');
    const shortageLines = productLines.filter(l => !l.isSufficient && (l.shortfallQty > 0 || l.deficit > 0));
    const totalDeficitQty = shortageLines.reduce((sum, l) => sum + (l.deficit || l.shortfallQty || 0), 0);
    const totalStockAllocated = productLines.reduce((sum, l) => sum + (l.allocatedFromStock || l.reservedQty || 0), 0);
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
    // Only non-packing line items (Products and Raw Materials) belong to Total Product Amount
    const nonPackingLines = computedLines.filter(l => (l.productId || l.rawMaterialId) && !l.isPackingCharge);
    const totalProductAmount = nonPackingLines.reduce((sum, l) => sum + (l.lineGross || 0), 0);
    const productLineDiscountTotal = nonPackingLines.reduce((sum, l) => sum + (l.lineDiscount || 0), 0);

    const totalBeforeDiscount = computedLines.reduce((sum, l) => sum + (l.lineGross || 0), 0);
    const lineDiscountTotal = computedLines.reduce((sum, l) => sum + (l.lineDiscount || 0), 0);
    const netLinesTotal = Math.max(0, totalBeforeDiscount - lineDiscountTotal);

    let docDiscAmt = 0;
    let effectiveDiscountPercent = Number(discountPercent) || 0;
    if (discountMode === 'amount') {
      docDiscAmt = Math.min(netLinesTotal, Math.max(0, Number(discountAmountInput) || 0));
      effectiveDiscountPercent = netLinesTotal > 0 ? (docDiscAmt / netLinesTotal) * 100 : 0;
    } else {
      docDiscAmt = effectiveDiscountPercent > 0 ? (netLinesTotal * (effectiveDiscountPercent / 100)) : 0;
    }

    const fAmt = Number(freight) || 0;
    const lAmt = Number(loadingCharges) || 0;
    const pAmt = Number(packingCharges) || 0;
    const oAmt = Number(otherCharges) || 0;

    // Line items marked as packing charges
    const packingLinesAmount = activeLines
      .filter(l => l.isPackingCharge)
      .reduce((sum, l) => sum + (l.lineTotal || 0), 0);

    // Extra manual packing beyond line items
    const extraPackingCharges = Math.max(0, pAmt - packingLinesAmount);

    // Dynamically build active charges list for the subtotal label
    const activeCharges = [];
    if (pAmt > 0) activeCharges.push('Packing');
    if (lAmt > 0) activeCharges.push('Loading');
    if (fAmt > 0) activeCharges.push('Freight');
    if (oAmt > 0) activeCharges.push('Other Charges');

    let productAndChargesLabel = 'Total Product Amount';
    if (activeCharges.length === 1) {
      productAndChargesLabel = `Total Product & ${activeCharges[0]} Amount`;
    } else if (activeCharges.length === 2) {
      productAndChargesLabel = `Total Product, ${activeCharges[0]} & ${activeCharges[1]}`;
    } else if (activeCharges.length > 2) {
      productAndChargesLabel = 'Total Product & Charges Amount';
    }

    // Product amount after discount + all available charges
    const netProductAmount = Math.max(0, totalProductAmount - (docDiscAmt + productLineDiscountTotal));
    const totalProductAndCharges = netProductAmount + fAmt + pAmt + lAmt + oAmt;

    const targetBuyerState = isInterState
      ? (placeOfSupply && String(placeOfSupply) !== String(sellerStateCode) ? placeOfSupply : (sellerStateCode === '33' ? '29' : '33'))
      : String(sellerStateCode);

    const fRate = getTaxRateFromCode(freightTaxCode);
    const lRate = getTaxRateFromCode(loadingTaxCode);
    const pRate = getTaxRateFromCode(packingTaxCode);
    const oRate = getTaxRateFromCode(otherTaxCode);

    const gstCalcResult = calculateGST({
      sellerStateCode: String(sellerStateCode || '33'),
      buyerStateCode: String(targetBuyerState || '33'),
      customerGstin: selectedCustomer?.gstin || taxRegNo,
      items: activeLines.map(l => ({
        productId: l.productId || l.rawMaterialId,
        rawMaterialId: l.rawMaterialId || undefined,
        itemType: l.itemType || (l.rawMaterialId ? 'RAW_MATERIAL' : 'PRODUCT'),
        isPackingCharge: Boolean(l.isPackingCharge),
        productName: l.itemDescription,
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        discount: Number(l.lineDiscount) || 0,
        discountPercent: Number(l.discountPercent) || 0,
        gstRate: l.isPackingCharge ? pRate : Number(l.gstRate !== undefined ? l.gstRate : 5),
        hsnCode: l.rawProduct?.hsnCode || l.rawMaterial?.hsnCode || l.rawProduct?.specifications?.hsnCode || (l.isPackingCharge ? '9985' : '21050000'),
        uomName: l.unitOfSale
      })),
      charges: {
        freight: fAmt,
        freightGst: fRate > 0,
        freightRate: fRate,
        loadingCharges: lAmt,
        loadingGst: lRate > 0,
        loadingChargesRate: lRate,
        packingCharges: extraPackingCharges,
        packingGst: pRate > 0,
        packingChargesRate: pRate,
        insurance: 0,
        insuranceGst: false,
        otherCharges: oAmt,
        otherGst: oRate > 0,
        otherChargesRate: oRate
      },
      invoiceDiscount: docDiscAmt,
      tdsDeduction: 0,
      placeOfSupply: String(targetBuyerState || '33')
    });

    const grandTotal = isRoundingEnabled ? gstCalcResult.grandTotal : gstCalcResult.netAmount;
    const roundOff = isRoundingEnabled ? gstCalcResult.roundOff : 0;
    const balanceDue = Math.max(0, grandTotal - (Number(advancePaid) || 0));

    return {
      totalProductAmount: round2(totalProductAmount),
      totalBeforeDiscount: round2(totalBeforeDiscount),
      lineDiscountTotal: round2(lineDiscountTotal),
      productLineDiscountTotal: round2(productLineDiscountTotal),
      docDiscAmt: round2(docDiscAmt),
      discountPercent: effectiveDiscountPercent,
      taxableSubtotal: gstCalcResult.taxableSubtotal,
      netTaxableSubtotal: gstCalcResult.netTaxableSubtotal,
      totalProductAndCharges: round2(totalProductAndCharges),
      productAndChargesLabel,
      activeCharges,
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
      packingChargesDisplay: pAmt,
      freightDisplay: fAmt,
      loadingChargesDisplay: lAmt,
      otherChargesDisplay: oAmt,
      gstCalcResult,
      gstSlabs: gstCalcResult.gstSlabs || []
    };
  }, [
    computedLines,
    activeLines,
    discountPercent,
    discountAmountInput,
    discountMode,
    freight, freightTaxCode,
    loadingCharges, loadingTaxCode,
    packingCharges, packingTaxCode,
    otherCharges, otherTaxCode,
    sellerStateCode, placeOfSupply, selectedCustomer, taxRegNo,
    isInterState,
    isRoundingEnabled,
    advancePaid
  ]);

  // Base total for calculating charges percentage (Excludes packing charges to prevent circular compounding)
  const goodsBaseTotal = useMemo(() => {
    const regularGoodsLines = activeLines.filter(l => !l.isPackingCharge);
    const goodsSum = regularGoodsLines.reduce((sum, l) => sum + (l.lineTotal || (Number(l.quantity || 1) * Number(l.unitPrice || 0)) || 0), 0);
    if (goodsSum > 0) return round2(goodsSum);
    const totalWithoutPacking = (financials?.totalBeforeDiscount || 0) - packingItemsSum;
    return round2(Math.max(0, totalWithoutPacking > 0 ? totalWithoutPacking : (financials?.totalBeforeDiscount || 0)));
  }, [activeLines, financials?.totalBeforeDiscount, packingItemsSum]);

  // Backward compatible baseTotalAmount
  const baseTotalAmount = goodsBaseTotal;

  // Dedicated Tax Code Handlers (Synchronizes line items when applicable)
  const handleFreightTaxCodeChange = (code) => {
    setFreightTaxCode(code);
  };

  const handleLoadingTaxCodeChange = (code) => {
    setLoadingTaxCode(code);
  };

  const handlePackingTaxCodeChange = (code) => {
    setPackingTaxCode(code);
    const rate = getTaxRateFromCode(code);
    setLines(prev => prev.map(l => {
      if (!l.isPackingCharge) return l;
      return {
        ...l,
        taxCode: code,
        gstRate: rate
      };
    }));
  };

  const handleOtherTaxCodeChange = (code) => {
    setOtherTaxCode(code);
  };

  // Dual percentage & amount change handlers for all charges (Bidirectional sync with Document Rows):
  const handleFreightAmountChange = (amt) => {
    const safeAmt = Math.max(0, amt);
    setFreight(safeAmt);
    setFreightPercent(goodsBaseTotal > 0 ? round2((safeAmt / goodsBaseTotal) * 100) : 0);
  };

  const handleFreightPercentChange = (pct) => {
    const safePct = Math.max(0, pct);
    setFreightPercent(safePct);
    setFreight(round2(goodsBaseTotal * (safePct / 100)));
  };

  // Multi-item Packaging Calculation & Pro-Rata Distribution by Quantity Helper:
  const distributePackingAcrossLines = (prevLines, targetAmount, currentPackingTaxCode) => {
    const taxCodeToUse = currentPackingTaxCode || packingTaxCode || 'IGST28';
    const taxRateToUse = getTaxRateFromCode(taxCodeToUse);
    const packingIndices = [];
    prevLines.forEach((l, idx) => {
      if (l.isPackingCharge) packingIndices.push(idx);
    });

    // If no line is marked as packing yet, find the first empty line
    if (packingIndices.length === 0) {
      if (targetAmount > 0) {
        const emptyIdx = prevLines.findIndex(l => !l.productId && !l.rawMaterialId && !l.itemDescription);
        if (emptyIdx !== -1) {
          const target = prevLines[emptyIdx];
          const qty = Math.max(1, Number(target.quantity) || 1);
          const newUnitPrice = round2(targetAmount / qty);
          return prevLines.map((l, idx) => {
            if (idx !== emptyIdx) return l;
            return {
              ...l,
              isPackingCharge: true,
              itemDescription: 'Packaging & Handling Charges',
              quantity: qty,
              unitPrice: newUnitPrice,
              lineDiscount: 0,
              discountPercent: 0,
              taxCode: taxCodeToUse,
              gstRate: taxRateToUse,
              lineTotal: targetAmount
            };
          });
        }
      }
      return prevLines;
    }

    if (targetAmount <= 0) {
      return prevLines.map((l, idx) => {
        if (!packingIndices.includes(idx)) return l;
        return {
          ...l,
          unitPrice: 0,
          lineDiscount: 0,
          discountPercent: 0,
          lineTotal: 0,
          taxCode: l.taxCode || taxCodeToUse,
          gstRate: l.gstRate !== undefined && l.gstRate !== null ? l.gstRate : taxRateToUse
        };
      });
    }

    const totalQty = packingIndices.reduce((sum, idx) => {
      return sum + Math.max(1, Number(prevLines[idx].quantity) || 1);
    }, 0);

    const k = packingIndices.length;
    let accumulatedActualTotal = 0;
    const lineUpdates = new Map();

    packingIndices.forEach((lineIdx, pIdx) => {
      const line = prevLines[lineIdx];
      const qty = Math.max(1, Number(line.quantity) || 1);
      const isLast = (pIdx === k - 1);

      let unitPrice = 0;
      let lineTotal = 0;

      if (isLast) {
        // Last packing item absorbs any rounding difference to ensure exact penny/paisa reconciliation
        const remainingTarget = Math.max(0, round2(targetAmount - accumulatedActualTotal));
        unitPrice = round2(remainingTarget / qty);
        lineTotal = round2(unitPrice * qty);
      } else {
        const targetLineAmt = round2(targetAmount * (qty / (totalQty || 1)));
        unitPrice = round2(targetLineAmt / qty);
        lineTotal = round2(unitPrice * qty);
        accumulatedActualTotal += lineTotal;
      }

      lineUpdates.set(lineIdx, {
        unitPrice,
        lineTotal,
        lineDiscount: 0,
        discountPercent: 0,
        taxCode: line.taxCode || taxCodeToUse,
        gstRate: line.gstRate !== undefined && line.gstRate !== null ? line.gstRate : taxRateToUse
      });
    });

    return prevLines.map((l, idx) => {
      if (!lineUpdates.has(idx)) return l;
      return {
        ...l,
        ...lineUpdates.get(idx)
      };
    });
  };

  const handlePackingAmountChange = (amt) => {
    const safeAmt = Math.max(0, amt);
    setPackingCharges(safeAmt);
    const calculatedPercent = goodsBaseTotal > 0 ? round2((safeAmt / goodsBaseTotal) * 100) : 0;
    setPackingPercent(calculatedPercent);

    // Synchronize packing lines in Document Rows by splitting proportionally across all checked raw materials
    setLines(prev => distributePackingAcrossLines(prev, safeAmt, packingTaxCode));
  };

  const handlePackingPercentChange = (pct) => {
    const safePct = Math.max(0, pct);
    setPackingPercent(safePct);
    const calculatedAmount = round2(goodsBaseTotal * (safePct / 100));
    setPackingCharges(calculatedAmount);

    // Synchronize packing lines in Document Rows by splitting proportionally across all checked raw materials
    setLines(prev => distributePackingAcrossLines(prev, calculatedAmount, packingTaxCode));
  };

  const handleLoadingAmountChange = (amt) => {
    const safeAmt = Math.max(0, amt);
    setLoadingCharges(safeAmt);
    setLoadingPercent(goodsBaseTotal > 0 ? round2((safeAmt / goodsBaseTotal) * 100) : 0);
  };

  const handleLoadingPercentChange = (pct) => {
    const safePct = Math.max(0, pct);
    setLoadingPercent(safePct);
    setLoadingCharges(round2(goodsBaseTotal * (safePct / 100)));
  };

  const handleOtherAmountChange = (amt) => {
    const safeAmt = Math.max(0, amt);
    setOtherCharges(safeAmt);
    setOtherPercent(goodsBaseTotal > 0 ? round2((safeAmt / goodsBaseTotal) * 100) : 0);
  };

  const handleOtherPercentChange = (pct) => {
    const safePct = Math.max(0, pct);
    setOtherPercent(safePct);
    setOtherCharges(round2(goodsBaseTotal * (safePct / 100)));
  };

  // Update specific line field with bidirectional sync for multi-item packing charges
  const handleLineChange = (lineId, field, value) => {
    if (isDocumentLocked) return;
    setLines(prev => {
      let isPackingToggleToTrue = false;
      let isPackingToggleToFalse = false;

      let updated = prev.map(l => {
        if (l.id !== lineId) return l;
        const lineUpdate = { ...l, [field]: value };
        if (field === 'isPackingCharge') {
          if (value) {
            isPackingToggleToTrue = true;
            lineUpdate.taxCode = packingTaxCode;
            lineUpdate.gstRate = getTaxRateFromCode(packingTaxCode);
          } else {
            isPackingToggleToFalse = true;
          }
        }
        if (field === 'taxCode') {
          lineUpdate.taxCode = value;
          lineUpdate.gstRate = getTaxRateFromCode(value);
        }
        return lineUpdate;
      });

      const currentLine = updated.find(l => l.id === lineId);
      const isPacking = Boolean(currentLine?.isPackingCharge);

      // Compute subtotal of non-packing goods
      const nonPackingLines = updated.filter(l => (l.productId || l.rawMaterialId) && !l.isPackingCharge);
      const newGoodsTotal = round2(nonPackingLines.reduce((sum, l) => {
        const qty = Number(l.quantity) || 1;
        const price = Number(l.unitPrice) || 0;
        const discPct = Number(l.discountPercent) || 0;
        const discAmt = price * (discPct / 100);
        return sum + ((price - discAmt) * qty);
      }, 0));

      const packingLines = updated.filter(l => l.isPackingCharge);

      if (field === 'isPackingCharge') {
        if (isPackingToggleToTrue) {
          // If packaging percentage or amount exists, distribute it across all packing items by quantity (Method A)
          let targetPackingAmt = 0;
          if (packingPercent > 0 && newGoodsTotal > 0) {
            targetPackingAmt = round2(newGoodsTotal * (packingPercent / 100));
          } else if (packingCharges > 0) {
            targetPackingAmt = packingCharges;
          }

          if (targetPackingAmt > 0) {
            setPackingCharges(targetPackingAmt);
            updated = distributePackingAcrossLines(updated, targetPackingAmt, packingTaxCode);
          } else {
            const totalPacking = round2(packingLines.reduce((sum, l) => {
              const q = Number(l.quantity) || 1;
              const p = Number(l.unitPrice) || 0;
              const d = Number(l.discountPercent) || 0;
              return sum + ((p - (p * (d / 100))) * q);
            }, 0));
            setPackingCharges(totalPacking);
            const effectiveBase = newGoodsTotal > 0 ? newGoodsTotal : goodsBaseTotal;
            if (effectiveBase > 0) {
              setPackingPercent(round2((totalPacking / effectiveBase) * 100));
            }
          }
        } else if (isPackingToggleToFalse) {
          // Reset price and total for the unchecked row so it doesn't inflate order
          updated = updated.map(l => l.id === lineId ? { ...l, unitPrice: 0, lineTotal: 0 } : l);
          const remainingPackingLines = updated.filter(l => l.isPackingCharge && l.id !== lineId);

          if (remainingPackingLines.length > 0) {
            let targetPackingAmt = 0;
            if (packingPercent > 0 && newGoodsTotal > 0) {
              targetPackingAmt = round2(newGoodsTotal * (packingPercent / 100));
            } else if (packingCharges > 0) {
              targetPackingAmt = packingCharges;
            }

            if (targetPackingAmt > 0) {
              setPackingCharges(targetPackingAmt);
              updated = distributePackingAcrossLines(updated, targetPackingAmt, packingTaxCode);
            } else {
              const remainingPacking = round2(remainingPackingLines.reduce((sum, l) => {
                const q = Number(l.quantity) || 1;
                const p = Number(l.unitPrice) || 0;
                const d = Number(l.discountPercent) || 0;
                return sum + ((p - (p * (d / 100))) * q);
              }, 0));
              setPackingCharges(remainingPacking);
              const effectiveBase = newGoodsTotal > 0 ? newGoodsTotal : goodsBaseTotal;
              if (effectiveBase > 0) {
                setPackingPercent(round2((remainingPacking / effectiveBase) * 100));
              }
            }
          } else {
            setPackingCharges(0);
            setPackingPercent(0);
          }
        }
      } else if (isPacking) {
        if (field === 'quantity') {
          // When changing quantity of a packing line:
          // Keep target package charges intact and re-distribute proportionally across new quantities (Method A)
          let targetPackingAmt = 0;
          if (packingPercent > 0 && newGoodsTotal > 0) {
            targetPackingAmt = round2(newGoodsTotal * (packingPercent / 100));
          } else if (packingCharges > 0) {
            targetPackingAmt = packingCharges;
          }

          if (targetPackingAmt > 0) {
            setPackingCharges(targetPackingAmt);
            updated = distributePackingAcrossLines(updated, targetPackingAmt, packingTaxCode);
          } else {
            const totalPacking = round2(packingLines.reduce((sum, l) => {
              const q = Number(l.quantity) || 1;
              const p = Number(l.unitPrice) || 0;
              const d = Number(l.discountPercent) || 0;
              return sum + ((p - (p * (d / 100))) * q);
            }, 0));
            setPackingCharges(totalPacking);
          }
        } else if (field === 'unitPrice' || field === 'discountPercent') {
          // User manually edited unit price on packing item, so sum all packing items
          const totalPacking = round2(packingLines.reduce((sum, l) => {
            const q = Number(l.quantity) || 1;
            const p = Number(l.unitPrice) || 0;
            const d = Number(l.discountPercent) || 0;
            return sum + ((p - (p * (d / 100))) * q);
          }, 0));
          setPackingCharges(totalPacking);
          const effectiveBase = newGoodsTotal > 0 ? newGoodsTotal : goodsBaseTotal;
          if (effectiveBase > 0) {
            setPackingPercent(round2((totalPacking / effectiveBase) * 100));
          }
        }
      } else if (!isPacking && (field === 'unitPrice' || field === 'quantity' || field === 'discountPercent')) {
        // Non-packing line changed
        if (packingPercent > 0 && newGoodsTotal > 0) {
          const newPackingAmt = round2(newGoodsTotal * (packingPercent / 100));
          setPackingCharges(newPackingAmt);
          updated = distributePackingAcrossLines(updated, newPackingAmt, packingTaxCode);
        }
        if (freightPercent > 0 && newGoodsTotal > 0) {
          setFreight(round2(newGoodsTotal * (freightPercent / 100)));
        }
        if (loadingPercent > 0 && newGoodsTotal > 0) {
          setLoadingCharges(round2(newGoodsTotal * (loadingPercent / 100)));
        }
        if (otherPercent > 0 && newGoodsTotal > 0) {
          setOtherCharges(round2(newGoodsTotal * (otherPercent / 100)));
        }
      }

      return updated;
    });
  };

  // Change Item Type between 'PRODUCT' and 'RAW_MATERIAL'
  const handleLineTypeChange = (lineId, newType) => {
    if (isDocumentLocked) return;
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const currentType = l.rawMaterialId || l.itemType === 'RAW_MATERIAL' ? 'RAW_MATERIAL' : 'PRODUCT';
      if (currentType === newType) return l;
      return {
        ...l,
        itemType: newType,
        productId: null,
        rawMaterialId: null,
        systemCode: '',
        itemDescription: '',
        category: '',
        baseCategory: '',
        subcategory: '',
        unitOfSale: newType === 'RAW_MATERIAL' ? 'kg' : 'pcs',
        unitPrice: 0,
        discountPercent: 0,
        stock: 0,
        rawProduct: null,
        rawMaterial: null,
        isPackingCharge: false,
        batchAllocations: []
      };
    }));
    setGridSearchScope(newType === 'RAW_MATERIAL' ? 'RAW_MATERIALS' : 'PRODUCTS');
  };

  // Select product for a line
  const handleSelectProductForLine = (lineId, product) => {
    if (isDocumentLocked || !product) return;
    const price = getProductSalePrice(product);
    const gstPct = (Number(product.cgst || 0) + Number(product.sgst || 0)) || Number(product.igst || 0) || 5;
    let taxCd;
    if (isInterState) {
      taxCd = gstPct === 18 ? 'IGST18' : (gstPct === 12 ? 'IGST12' : (gstPct === 28 ? 'IGST28' : (gstPct === 9 ? 'IGST9' : (gstPct === 0 ? 'EXEMPT' : 'IGST5'))));
    } else {
      taxCd = gstPct === 18 ? 'SCG18' : (gstPct === 12 ? 'SCG12' : (gstPct === 28 ? 'SCG28' : (gstPct === 9 ? 'SCG9' : (gstPct === 0 ? 'EXEMPT' : 'SCG5'))));
    }
    const liveStock = getProductLiveStock(product);

    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      return {
        ...l,
        productId: product.id,
        rawMaterialId: null,
        itemType: 'PRODUCT',
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
        rawProduct: product,
        rawMaterial: null,
        batchAllocations: []
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

  // Select Raw Material for resale / packing item in a specific line
  const handleSelectRawMaterialForLine = (lineId, rm, asPacking = false) => {
    if (isDocumentLocked || !rm) return;
    const price = Number(rm.ratePerUnit || 0);
    const gstPct = 18;
    const taxCd = isInterState ? 'IGST18' : 'SCG18';
    const liveStock = Number(rm.currentStock || 0);
    const isPack = asPacking || (rm.category?.name || '').toUpperCase().includes('PACKING') || (rm.name || '').toUpperCase().includes('BOX') || (rm.name || '').toUpperCase().includes('ICE');

    setLines(prev => {
      let mapped = prev.map(l => {
        if (l.id !== lineId) return l;
        return {
          ...l,
          productId: null,
          rawMaterialId: rm.id,
          itemType: 'RAW_MATERIAL',
          systemCode: rm.code || 'RM',
          itemDescription: rm.printName || rm.name,
          category: rm.category?.name || rm.category || (isPack ? 'Packing Items' : 'Raw Material'),
          baseCategory: 'Raw Material',
          subcategory: '-',
          unitOfSale: rm.unitId || 'kg',
          unitPrice: price,
          discountPercent: 0,
          taxCode: taxCd,
          gstRate: gstPct,
          stock: liveStock,
          rawMaterial: rm,
          rawProduct: null,
          isPackingCharge: isPack,
          batchAllocations: []
        };
      });

      if (isPack) {
        let targetPackingAmt = 0;
        if (packingPercent > 0 && goodsBaseTotal > 0) {
          targetPackingAmt = round2(goodsBaseTotal * (packingPercent / 100));
        } else if (packingCharges > 0) {
          targetPackingAmt = packingCharges;
        }

        if (targetPackingAmt > 0) {
          setPackingCharges(targetPackingAmt);
          mapped = distributePackingAcrossLines(mapped, targetPackingAmt, packingTaxCode);
        } else if (price > 0) {
          const packLines = mapped.filter(l => l.isPackingCharge);
          const totalPack = round2(packLines.reduce((sum, l) => sum + (Number(l.quantity || 1) * Number(l.unitPrice || 0)), 0));
          setPackingCharges(totalPack);
        }
      }

      const idx = mapped.findIndex(l => l.id === lineId);
      if (idx === mapped.length - 1) {
        return [...mapped, createEmptyLine(mapped.length + 1)];
      }
      return mapped;
    });

    setActiveGridSearchLineId(null);

    setStatusMessage({
      type: 'ready',
      text: `✔ Added Raw Material "${rm.name}" (${rm.code}) @ ₹${price.toFixed(2)} • Live Stock: ${liveStock} ${rm.unitId || 'kg'}`
    });
  };

  // Add Raw Material from Catalog modal
  const handleAddRawMaterialFromCatalog = (rm, asPacking = false) => {
    if (isDocumentLocked || !rm) return;
    let emptyLine = lines.find(l => !l.productId && !l.rawMaterialId);
    if (emptyLine) {
      handleSelectRawMaterialForLine(emptyLine.id, rm, asPacking);
    } else {
      const newLine = createEmptyLine(lines.length + 1);
      setLines(prev => [...prev, newLine]);
      setTimeout(() => {
        handleSelectRawMaterialForLine(newLine.id, rm, asPacking);
      }, 50);
    }
  };

  // Open compact FEFO Stock Lot Allocation Modal
  const handleOpenRMLotModal = (line) => {
    setActiveRMLotLine(line);
    setIsRMLotModalOpen(true);
  };

  // Apply batch lot allocations returned from RMLotAllocationModal
  const handleApplyRMLotAllocations = (allocations, totalAllocatedQty) => {
    if (!activeRMLotLine) return;
    setLines(prev => prev.map(l => {
      if (l.id !== activeRMLotLine.id) return l;
      return {
        ...l,
        batchAllocations: allocations,
        quantity: totalAllocatedQty > 0 ? totalAllocatedQty : l.quantity
      };
    }));
    setStatusMessage({
      type: 'ready',
      text: `✔ Allocated ${allocations.length} lot batch(es) for "${activeRMLotLine.itemDescription}".`
    });
    setIsRMLotModalOpen(false);
    setActiveRMLotLine(null);
  };

  // Add line to grid from top search bar or catalog modal
  const handleAddProductFromCatalog = (product) => {
    let emptyLine = lines.find(l => !l.productId && !l.rawMaterialId);
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
    if (isDocumentLocked) return;
    setLines(prev => {
      if (prev.length <= 1) {
        setPackingCharges(0);
        return [createEmptyLine(1)];
      }
      const filtered = prev.filter(l => l.id !== lineId);
      const packingSum = filtered
        .filter(l => (l.productId || l.rawMaterialId) && l.isPackingCharge)
        .reduce((sum, l) => {
          const qty = Number(l.quantity) || 1;
          const price = Number(l.unitPrice) || 0;
          const discPct = Number(l.discountPercent) || 0;
          const discAmt = price * (discPct / 100);
          return sum + ((price - discAmt) * qty);
        }, 0);
      setPackingCharges(round2(packingSum));
      return filtered.map((l, i) => ({ ...l, rowNo: i + 1 }));
    });
  };

  // Add empty line
  const handleAddLine = () => {
    if (isDocumentLocked) return;
    setLines(prev => [...prev, createEmptyLine(prev.length + 1)]);
  };

  // Clear all empty lines
  const handleClearEmptyLines = () => {
    if (isDocumentLocked) return;
    const filled = lines.filter(l => l.productId || l.rawMaterialId);
    if (filled.length === 0) {
      setPackingCharges(0);
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
        const oldAttachment = updatingAttachmentId ? attachments.find(a => a.id === updatingAttachmentId) : null;
        const oldFileUrl = oldAttachment?.url || null;

        try {
          const res = await api.post('/orders/upload-attachment', {
            imageData: base64Data,
            orderId: currentOrderId,
            oldFileUrl: oldFileUrl
          });

          if (res.data?.success && res.data?.url) {
            const ext = file.name ? file.name.split('.').pop() : 'jpg';
            const itemData = {
              url: res.data.url,
              filename: res.data.filename || `order_${currentOrderId}_${Date.now()}.${ext}`,
              fileSize: (file.size / 1024).toFixed(1) + ' KB',
              uploadedAt: new Date().toLocaleTimeString(),
              orderId: currentOrderId
            };

            if (updatingAttachmentId) {
              setAttachments(prev => prev.map(a => a.id === updatingAttachmentId ? { ...a, ...itemData } : a));
              if (oldFileUrl) {
                setRemovedAttachmentUrls(prev => [...prev.filter(u => u !== oldFileUrl), oldFileUrl]);
              }
              setStatusMessage({
                type: 'ready',
                text: `✔ Updated attachment in @[UPLOADS_DIR]: ${itemData.filename}`
              });
              Swal.fire({
                icon: 'success',
                title: 'Attachment Updated!',
                text: `Old file removed from disk. Saved new file ${itemData.filename} in @[UPLOADS_DIR]`,
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
                text: `✔ Saved file to @[UPLOADS_DIR]: ${newAttachment.filename}`
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
      console.error('Error reading file:', err);
    }
  };

  // Handle Removing Attachment (Permanently removes from server @[UPLOADS_DIR] and State)
  const handleRemoveAttachment = async (att) => {
    if (!att) return;

    const result = await Swal.fire({
      title: 'Remove Attachment?',
      html: `
        <div class="text-left text-xs space-y-1.5 p-1">
          <p class="text-slate-700 dark:text-slate-300">Are you sure you want to remove <strong>${att.filename}</strong>?</p>
          <p class="text-rose-600 dark:text-rose-400 font-medium">This will permanently delete the file from the server uploads directory (<span class="font-mono font-bold">@[UPLOADS_DIR]</span>).</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete from Uploads',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b'
    });

    if (!result.isConfirmed) return;

    try {
      // 1. Delete physical file from server uploads folder
      await api.post('/orders/delete-attachment', {
        fileUrl: att.url,
        filename: att.filename,
        orderId: editOrderId,
        orderDocNo: docNo
      });

      // 2. Remove from React state
      setAttachments(prev => prev.filter(a => a.id !== att.id));
      setRemovedAttachmentUrls(prev => [...prev, att.url]);

      setStatusMessage({
        type: 'ready',
        text: `✔ Attachment ${att.filename} deleted from server @[UPLOADS_DIR].`
      });

      Swal.fire({
        icon: 'success',
        title: 'Attachment Deleted!',
        text: `"${att.filename}" has been permanently removed from server uploads.`,
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (err) {
      console.error('Failed to remove attachment from server:', err);
      // Remove from UI even if error
      setAttachments(prev => prev.filter(a => a.id !== att.id));
      setRemovedAttachmentUrls(prev => [...prev, att.url]);
      Swal.fire({
        icon: 'info',
        title: 'Attachment Removed',
        text: err.response?.data?.error || 'Attachment removed from order view.',
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    }
  };

  // Load existing order for editing when editOrderId is present
  useEffect(() => {
    if (!editOrderId) return;
    api.get(`/orders/${editOrderId}`).then(res => {
      const ord = res.data;
      if (!ord) return;
      setLoadedOrderData(ord);
      setDocNo(ord.docNo || ord.referenceNo || '');
      setDocSeries(ord.documentSeries || 'Primary');
      setDocStatus(ord.status || 'Open');
      setOrderMode(ord.orderMode === 'NEED_PLANNING' ? 'STANDARD' : (ord.orderMode || (ord.type === 'Invoice' ? 'INVOICE' : (ord.type === 'Quotation' ? 'QUOTATION' : 'STANDARD'))));
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

      // Resolve supply type for accurate ancillary charge tax codes (Intra vs Inter state)
      const orderPlaceOfSupply = ord.placeOfSupply || ord.buyerStateCode || '33';
      const isInter = String(orderPlaceOfSupply) !== String(sellerStateCode) || ord.taxType === 'Inter-State' || ord.taxType === 'INTER_STATE';
      const defaultTaxCode = isInter ? 'IGST18' : 'SCG18';

      // Populate Freight & Additional Logistics Charges and their GST tax codes
      setFreight(Number(ord.freight || 0));
      if (ord.freightTaxCode) setFreightTaxCode(mapTaxCodeForSupplyType(ord.freightTaxCode, isInter));
      else if (ord.freightGst !== undefined) setFreightTaxCode(ord.freightGst ? defaultTaxCode : 'EXEMPT');

      setLoadingCharges(Number(ord.loadingCharges || 0));
      if (ord.loadingTaxCode) setLoadingTaxCode(mapTaxCodeForSupplyType(ord.loadingTaxCode, isInter));
      else if (ord.loadingGst !== undefined) setLoadingTaxCode(ord.loadingGst ? defaultTaxCode : 'EXEMPT');

      setPackingCharges(Number(ord.packingCharges || 0));
      if (ord.packingTaxCode) setPackingTaxCode(mapTaxCodeForSupplyType(ord.packingTaxCode, isInter));
      else if (ord.packingGst !== undefined) setPackingTaxCode(ord.packingGst ? defaultTaxCode : 'EXEMPT');

      setOtherCharges(Number(ord.otherCharges || 0));
      if (ord.otherTaxCode) setOtherTaxCode(mapTaxCodeForSupplyType(ord.otherTaxCode, isInter));
      else if (ord.otherGst !== undefined) setOtherTaxCode(ord.otherGst ? defaultTaxCode : 'EXEMPT');

      setIsRoundingEnabled(true);

      // Clean remarks & parse attachments, payment details, and terms from internalNote
      let loadedAttachments = [];
      if (ord.internalNote && ord.internalNote.includes('[[ATTACHMENT:')) {
        const match = ord.internalNote.match(/\[\[ATTACHMENT:(.*?)\]\]/);
        if (match && match[1]) {
          try {
            const parsed = JSON.parse(match[1]);
            if (Array.isArray(parsed) && parsed.length > 0) loadedAttachments = parsed;
          } catch (e) {
            console.error('Error parsing attachments:', e);
          }
        }
      } else if (ord.attachmentUrl) {
        const urls = ord.attachmentUrl.split(',').map(u => u.trim()).filter(Boolean);
        loadedAttachments = urls.map((u, i) => ({
          id: `att_${Date.now()}_${i}`,
          url: u,
          filename: u.split('/').pop() || `attachment_${i + 1}.jpg`,
          fileSize: 'Uploaded',
          uploadedAt: new Date().toLocaleTimeString(),
          orderId: ord.docNo || ord.referenceNo
        }));
      }
      setAttachments(loadedAttachments);

      // Restore dynamic payment settlement details
      let pDetails = ord.paymentDetails;
      if (!pDetails && ord.internalNote && ord.internalNote.includes('[[PAYMENT_DETAILS:')) {
        const m = ord.internalNote.match(/\[\[PAYMENT_DETAILS:(.*?)\]\]/);
        if (m && m[1]) {
          try {
            pDetails = JSON.parse(m[1]);
          } catch (e) {}
        }
      }
      if (pDetails) {
        if (pDetails.bankName || pDetails.accountNo || pDetails.ifsc || pDetails.branch) {
          setBankTransferDetails(prev => ({
            ...prev,
            bankName: pDetails.bankName || '',
            accountNo: pDetails.accountNo || pDetails.bankAccountNo || '',
            ifsc: pDetails.ifsc || pDetails.bankIfsc || '',
            branch: pDetails.branch || pDetails.bankBranch || '',
            transactionRef: pDetails.transactionRef || ''
          }));
        }
        if (pDetails.upiId || pDetails.mobileNo || pDetails.utrRef) {
          setUpiDetails(prev => ({
            ...prev,
            upiId: pDetails.upiId || '',
            mobileNo: pDetails.mobileNo || pDetails.upiPhone || '',
            utrRef: pDetails.utrRef || pDetails.transactionRef || ''
          }));
        }
        if (pDetails.cardLast4 || pDetails.terminalCode) {
          setCardDetails(prev => ({
            ...prev,
            cardLast4: pDetails.cardLast4 || '',
            cardNetwork: pDetails.cardNetwork || 'Visa / RuPay',
            terminalCode: pDetails.terminalCode || ''
          }));
        }
        if (pDetails.cashReceived || pDetails.cashierNote) {
          setCashDetails(prev => ({
            ...prev,
            cashReceived: pDetails.cashReceived || 0,
            cashierNote: pDetails.cashierNote || ''
          }));
        }
      }

      // Restore custom order terms & conditions
      let loadedOrderTerms = '';
      if (ord.termsAndConditions) {
        loadedOrderTerms = ord.termsAndConditions;
      } else if (ord.internalNote && ord.internalNote.includes('[[TERMS_AND_CONDITIONS:')) {
        const m = ord.internalNote.match(/\[\[TERMS_AND_CONDITIONS:(.*?)\]\]/);
        if (m && m[1]) {
          try {
            loadedOrderTerms = decodeURIComponent(m[1]);
          } catch (e) {
            loadedOrderTerms = m[1];
          }
        }
      }
      setOrderTerms(loadedOrderTerms);

      const cleanNote = (ord.internalNote || ord.quotationNote || '')
        .replace(/\[\[ATTACHMENT:.*?\]\]/gs, '')
        .replace(/\[\[PAYMENT_DETAILS:.*?\]\]/gs, '')
        .replace(/\[\[TERMS_AND_CONDITIONS:.*?\]\]/gs, '')
        .replace(/\[\[ANCILLARY_TAX_CODES:.*?\]\]/gs, '')
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
          // Strictly distinguish Raw Material vs Finished Product:
          // A line is a Raw Material ONLY if explicitly set or has rawMaterialId without a productId.
          const isRM = it.itemType === 'RAW_MATERIAL' 
            || (Boolean(it.rawMaterialId) && !it.productId && !it.product) 
            || (Boolean(it.rawMaterial) && !it.productId && !it.product);

          const rmObj = isRM 
            ? (it.rawMaterial || (it.rawMaterialId ? rmMap.get(it.rawMaterialId) : null) || (it.rawMaterialCode ? Array.from(rmMap.values()).find(r => r.code?.toLowerCase() === it.rawMaterialCode?.toLowerCase()) : null))
            : null;

          const prodObj = !isRM
            ? (it.product || (it.productId ? productMap.get(it.productId) : null) || (it.productCode ? Array.from(productMap.values()).find(p => p.code?.toLowerCase() === it.productCode?.toLowerCase()) : null) || Array.from(productMap.values()).find(p => p.name?.toLowerCase() === it.productName?.toLowerCase()))
            : null;

          const itemGst = Number(it.gstRate !== undefined && it.gstRate !== null ? it.gstRate : (isRM ? (rmObj?.gstRate || 18) : (prodObj?.gstRate || it.product?.gstRate || 5)));
          const taxCd = isInter
            ? (itemGst === 18 ? 'IGST18' : (itemGst === 12 ? 'IGST12' : (itemGst === 28 ? 'IGST28' : (itemGst === 9 ? 'IGST9' : (itemGst === 0 ? 'EXEMPT' : 'IGST5')))))
            : (itemGst === 18 ? 'SCG18' : (itemGst === 12 ? 'SCG12' : (itemGst === 28 ? 'SCG28' : (itemGst === 9 ? 'SCG9' : (itemGst === 0 ? 'EXEMPT' : 'SCG5')))));
          const liveStock = isRM
            ? Number(rmObj?.currentStock !== undefined ? rmObj.currentStock : (rmObj?.availableQuantity !== undefined ? rmObj.availableQuantity : (it.rawMaterial?.currentStock !== undefined ? it.rawMaterial.currentStock : 0)))
            : (prodObj ? getProductLiveStock(prodObj) : (it.product ? getProductLiveStock(it.product) : 0));
          const uPrice = Number(it.unitPrice || 0);
          const lineDisc = Number(it.discount || 0);
          const discPct = Number(it.discountPercent !== undefined ? it.discountPercent : (lineDisc && uPrice ? (lineDisc / uPrice) * 100 : 0));

          const restoredAllocations = (Array.isArray(it.batchAllocationsData) && it.batchAllocationsData.length > 0)
            ? it.batchAllocationsData
            : (it.batchId || it.batchNo ? [{
                batchId: it.batchId,
                id: it.batchId,
                batchNo: it.batchNo,
                allocatedQty: Number(it.quantity || 1),
                quantity: Number(it.quantity || 1),
                expiryDate: it.expiryDate,
                mfgDate: it.mfgDate
              }] : (Array.isArray(it.batchAllocations) ? it.batchAllocations : []));

          return {
            id: `line_${it.id || idx}`,
            rowNo: idx + 1,
            productId: isRM ? null : (prodObj?.id || it.productId),
            rawMaterialId: isRM ? (rmObj?.id || it.rawMaterialId) : null,
            itemType: isRM ? 'RAW_MATERIAL' : 'PRODUCT',
            isPackingCharge: Boolean(it.isPackingCharge),
            batchAllocations: restoredAllocations,
            systemCode: isRM 
              ? (rmObj?.code || rmObj?.sku || it.rawMaterial?.code || it.productCode || (it.hsnCode ? `RM-${it.hsnCode}` : `RM-${idx + 1}`)) 
              : (it.productCode || it.systemCode || prodObj?.code || prodObj?.systemCode || it.product?.code || `BFD10${idx + 1}`),
            itemDescription: isRM 
              ? (it.productName || rmObj?.printName || rmObj?.name || it.rawMaterial?.name || '') 
              : (it.productName || prodObj?.name || prodObj?.productName || it.product?.name || ''),
            category: isRM 
              ? (it.category || rmObj?.category?.name || rmObj?.category || (it.isPackingCharge ? 'Packing Items' : 'Raw Material')) 
              : (it.category || it.categoryName || prodObj?.category?.name || prodObj?.category || it.product?.category?.name || 'Ice Cream'),
            baseCategory: isRM 
              ? 'Raw Material' 
              : (it.baseCategory || prodObj?.baseCategory || prodObj?.subcategory?.name || it.product?.subcategory?.name || 'General'),
            subcategory: isRM 
              ? (rmObj?.subcategory?.name || rmObj?.subcategory || '-') 
              : (it.subcategory || prodObj?.subcategory?.name || prodObj?.subcategory || it.product?.subcategory?.name || '-'),
            unitOfSale: isRM 
              ? (it.uomName || rmObj?.unitId || rmObj?.uom?.abbreviation || 'kg') 
              : (it.uomName || prodObj?.unitOfSale || prodObj?.unit?.name || it.product?.unit?.name || 'pcs'),
            quantity: Number(it.quantity || 1),
            unitPrice: uPrice,
            discountPercent: discPct,
            taxCode: taxCd,
            gstRate: itemGst,
            distrRule: isRM ? 'Raw Material Warehouse' : 'Main FG Warehouse',
            stock: liveStock,
            rawProduct: isRM ? null : (prodObj || it.product),
            rawMaterial: isRM ? (rmObj || it.rawMaterial) : null
          };
        }));
      }

      const rawLines = Array.isArray(ord.items) ? ord.items : [];
      const snapLines = rawLines.map((it) => {
        const isRM = it.itemType === 'RAW_MATERIAL' 
          || (Boolean(it.rawMaterialId) && !it.productId && !it.product) 
          || (Boolean(it.rawMaterial) && !it.productId && !it.product);

        const itemGst = Number(it.gstRate !== undefined && it.gstRate !== null ? it.gstRate : (isRM ? 18 : (it.product?.gstRate || 5)));
        const uPrice = Number(it.unitPrice || 0);
        const lineDisc = Number(it.discount || 0);
        const discPct = Number(it.discountPercent !== undefined ? it.discountPercent : (lineDisc && uPrice ? (lineDisc / uPrice) * 100 : 0));
        return {
          productId: isRM ? null : (it.productId || it.product?.id),
          rawMaterialId: isRM ? (it.rawMaterialId || null) : null,
          itemType: isRM ? 'RAW_MATERIAL' : 'PRODUCT',
          isPackingCharge: Boolean(it.isPackingCharge),
          quantity: Number(it.quantity || 1),
          unitPrice: uPrice,
          discountPercent: discPct,
          gstRate: itemGst
        };
      }).sort((a, b) => ((a.productId || a.rawMaterialId || '')).localeCompare(b.productId || b.rawMaterialId || ''));

      const calcDiscPct = Number(ord.discountPercent !== undefined && ord.discountPercent !== null && Number(ord.discountPercent) > 0
        ? Number(ord.discountPercent)
        : (discVal > 0 && grossItemsSubtotal > 0 ? Number(((discVal / grossItemsSubtotal) * 100).toFixed(2)) : 0));

      const snap = JSON.stringify({
        customerId: ord.customerId || '',
        customerRefNo: ord.customerRefNo || ord.referenceNo || '',
        contactPerson: ord.customer?.contactPerson || ord.customerPhone || '',
        shipToAddress: ord.deliveryAddress || '',
        billToAddress: ord.billToAddress || ord.customer?.billingAddress || '',
        docSeries: ord.documentSeries || 'Primary',
        orderMode: (ord.orderMode === 'NEED_PLANNING' ? 'STANDARD' : (ord.orderMode || (ord.type === 'Invoice' ? 'INVOICE' : (ord.type === 'Quotation' ? 'QUOTATION' : 'STANDARD')))),
        docStatus: ord.status || 'Open',
        postingDate: ord.createdAt ? ord.createdAt.split('T')[0] : '',
        deliveryDate: ord.deliveryDate ? ord.deliveryDate.split('T')[0] : '',
        documentDate: ord.createdAt ? ord.createdAt.split('T')[0] : '',
        salesEmployee: ord.salesEmployee || '-No Sales Employee-',
        remarks: cleanNote,
        orderTerms: (loadedOrderTerms || '').trim(),
        attachments: (loadedAttachments || []).map(a => a.url || a.filename || '').sort().join(','),
        discountPercent: calcDiscPct,
        freight: Number(ord.freight || 0),
        loadingCharges: Number(ord.loadingCharges || 0),
        packingCharges: Number(ord.packingCharges || 0),
        otherCharges: Number(ord.otherCharges || 0),
        shippingMethod: ord.shippingMethod || 'Road Transport',
        transporterName: ord.transporterName || '',
        vehicleNo: ord.vehicleNo || '',
        lrNo: ord.lrNo || '',
        ewayBillNo: ord.ewayBillNo || '',
        paymentTerms: ord.paymentTerms || 'Not Paid',
        paymentMethod: ord.paymentMode || 'Bank Transfer / NEFT',
        advancePaid: Number(ord.amountPaid || 0),
        placeOfSupply: ord.placeOfSupply || ord.buyerStateCode || '33',
        lines: snapLines
      });
      setInitialSnapshot(snap);

      setStatusMessage({
        type: 'ready',
        text: `✔ Loaded Order #${ord.docNo || ord.referenceNo} for editing. Tax and logistics amounts calculated.`
      });
    }).catch(err => console.error('Failed to load edit order', err));
  }, [editOrderId]);

  // Load source order for conversion to Tax Invoice when convertFromId is present
  useEffect(() => {
    if (!convertFromId || editOrderId) return;
    api.get(`/orders/${convertFromId}`).then(res => {
      const ord = res.data;
      if (!ord) return;
      setSourceOrderId(ord.id);
      setSourceDocNo(ord.docNo || ord.referenceNo || '');
      setOrderMode('INVOICE');
      setDocNo('Assigned on posting');
      setDocSeries('Primary');
      setDocStatus('Open');
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
      setOwner(currentUser?.name || ord.creator?.name || 'Administrator');

      setFreight(Number(ord.freight || 0));
      setFreightGst(ord.freightGst !== undefined ? Boolean(ord.freightGst) : true);
      setLoadingCharges(Number(ord.loadingCharges || 0));
      setLoadingGst(ord.loadingGst !== undefined ? Boolean(ord.loadingGst) : true);
      setPackingCharges(Number(ord.packingCharges || 0));
      setPackingGst(ord.packingGst !== undefined ? Boolean(ord.packingGst) : true);
      setOtherCharges(Number(ord.otherCharges || 0));
      setOtherGst(ord.otherGst !== undefined ? Boolean(ord.otherGst) : true);
      setIsRoundingEnabled(true);

      const cleanNote = (ord.internalNote || ord.quotationNote || '')
        .replace(/\[\[ATTACHMENT:.*?\]\]/gs, '')
        .replace(/\[Fulfillment Mode:.*?\]/g, '')
        .trim();
      setRemarks(`Converted from Order #${ord.docNo || ord.referenceNo}${cleanNote ? ' • ' + cleanNote : ''}`);

      setPostingDate(new Date().toISOString().split('T')[0]);
      setDocumentDate(new Date().toISOString().split('T')[0]);
      if (ord.deliveryDate) {
        setDeliveryDate(ord.deliveryDate.split('T')[0]);
      }

      if (Array.isArray(ord.items) && ord.items.length > 0) {
        setLines(ord.items.map((it, idx) => {
          const isRM = it.itemType === 'RAW_MATERIAL' 
            || (Boolean(it.rawMaterialId) && !it.productId && !it.product) 
            || (Boolean(it.rawMaterial) && !it.productId && !it.product);

          const rmObj = isRM 
            ? (it.rawMaterial || (it.rawMaterialId ? rmMap.get(it.rawMaterialId) : null) || (it.rawMaterialCode ? Array.from(rmMap.values()).find(r => r.code?.toLowerCase() === it.rawMaterialCode?.toLowerCase()) : null))
            : null;

          const prodObj = !isRM
            ? (it.product || (it.productId ? productMap.get(it.productId) : null) || (it.productCode ? Array.from(productMap.values()).find(p => p.code?.toLowerCase() === it.productCode?.toLowerCase()) : null) || Array.from(productMap.values()).find(p => p.name?.toLowerCase() === it.productName?.toLowerCase()))
            : null;

          const itemGst = Number(it.gstRate !== undefined && it.gstRate !== null ? it.gstRate : (isRM ? (rmObj?.gstRate || 18) : (prodObj?.gstRate || it.product?.gstRate || 5)));
          const taxCd = isInterState
            ? (itemGst === 18 ? 'IGST18' : (itemGst === 12 ? 'IGST12' : (itemGst === 28 ? 'IGST28' : (itemGst === 9 ? 'IGST9' : (itemGst === 0 ? 'EXEMPT' : 'IGST5')))))
            : (itemGst === 18 ? 'SCG18' : (itemGst === 12 ? 'SCG12' : (itemGst === 28 ? 'SCG28' : (itemGst === 9 ? 'SCG9' : (itemGst === 0 ? 'EXEMPT' : 'SCG5')))));
          const liveStock = isRM 
            ? Number(rmObj?.currentStock !== undefined ? rmObj.currentStock : (rmObj?.availableQuantity !== undefined ? rmObj.availableQuantity : (it.rawMaterial?.currentStock !== undefined ? it.rawMaterial.currentStock : 0)))
            : (prodObj ? getProductLiveStock(prodObj) : (it.product ? getProductLiveStock(it.product) : 0));
          const uPrice = Number(it.unitPrice || 0);
          const lineDisc = Number(it.discount || 0);
          const discPct = Number(it.discountPercent !== undefined ? it.discountPercent : (lineDisc && uPrice ? (lineDisc / uPrice) * 100 : 0));
          const invoicedAlready = Number(it.invoicedQty || 0);
          const totalOrderQty = Number(it.quantity || 1);
          const remainingToBill = Math.max(0, totalOrderQty - invoicedAlready);

          return {
            id: `line_${it.id || idx}`,
            sourceOrderItemId: it.id,
            rowNo: idx + 1,
            productId: isRM ? null : (prodObj?.id || it.productId),
            rawMaterialId: isRM ? (rmObj?.id || it.rawMaterialId) : null,
            itemType: isRM ? 'RAW_MATERIAL' : 'PRODUCT',
            isPackingCharge: Boolean(it.isPackingCharge),
            batchAllocations: it.batchAllocationsData || it.batchAllocations || [],
            systemCode: isRM 
              ? (rmObj?.code || rmObj?.sku || it.rawMaterial?.code || it.productCode || (it.hsnCode ? `RM-${it.hsnCode}` : `RM-${idx + 1}`)) 
              : (it.productCode || it.systemCode || prodObj?.code || prodObj?.systemCode || it.product?.code || `BFD10${idx + 1}`),
            itemDescription: isRM 
              ? (it.productName || rmObj?.printName || rmObj?.name || it.rawMaterial?.name || '') 
              : (it.productName || prodObj?.name || prodObj?.productName || it.product?.name || ''),
            category: isRM 
              ? (it.category || rmObj?.category?.name || rmObj?.category || (it.isPackingCharge ? 'Packing Items' : 'Raw Material')) 
              : (it.category || it.categoryName || prodObj?.category?.name || prodObj?.category || it.product?.category?.name || 'Ice Cream'),
            baseCategory: isRM 
              ? 'Raw Material' 
              : (it.baseCategory || prodObj?.baseCategory || prodObj?.subcategory?.name || it.product?.subcategory?.name || 'General'),
            subcategory: isRM 
              ? (rmObj?.subcategory?.name || rmObj?.subcategory || '-') 
              : (it.subcategory || prodObj?.subcategory?.name || prodObj?.subcategory || it.product?.subcategory?.name || '-'),
            unitOfSale: isRM 
              ? (it.uomName || rmObj?.unitId || rmObj?.uom?.abbreviation || 'kg') 
              : (it.uomName || prodObj?.unitOfSale || prodObj?.unit?.name || it.product?.unit?.name || 'pcs'),
            quantity: remainingToBill > 0 ? remainingToBill : totalOrderQty,
            unitPrice: uPrice,
            discountPercent: discPct,
            taxCode: taxCd,
            gstRate: itemGst,
            rawProduct: isRM ? null : (prodObj || it.product),
            rawMaterial: isRM ? (rmObj || it.rawMaterial) : null,
            sourceReservedQty: Number(it.reservedQty || 0),
            sourceShortfallQty: Number(it.shortfallQty || 0),
            stock: liveStock
          };
        }));
      }

      setStatusMessage({
        type: 'ready',
        text: `✔ Converting Order #${ord.docNo || ord.referenceNo} to Tax Invoice. Reserved stock carried over.`
      });
    }).catch(err => {
      console.error('Failed to load convertFrom order:', err);
      setStatusMessage({
        type: 'error',
        text: `✖ Could not load source order for conversion: ${err.message}`
      });
    });
  }, [convertFromId, editOrderId, currentUser]);

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
      setRemovedAttachmentUrls([]);

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
        const fromUrl = searchParams.get('from') || '/sales/list';
        navigate(fromUrl);
        return;
      }

      const isInvoice = variables?.orderMode === 'INVOICE' || variables?.type === 'Invoice';
      const isQuotation = variables?.orderMode === 'QUOTATION' || variables?.type === 'Quotation';
      const hasShortages = stockDeficitSummary.hasShortages;

      Swal.fire({
        title: isInvoice
          ? 'Tax Invoice Generated!'
          : (isQuotation 
            ? 'Quotation Created!' 
            : (hasShortages ? 'Standard Order Saved (Back-Order)' : 'Standard Order Confirmed!')),
        html: `
          <div class="text-left font-sans text-sm space-y-2 p-2">
            <div class="flex justify-between border-b pb-1">
              <span class="text-slate-500">Document No:</span>
              <span class="font-bold text-slate-800">${data.docNo || docNo}</span>
            </div>
            <div class="flex justify-between border-b pb-1">
              <span class="text-slate-500">Document Mode:</span>
              <span class="font-bold ${isInvoice ? 'text-blue-600' : isQuotation ? 'text-purple-600' : 'text-emerald-600'}">
                ${isInvoice ? '🔵 Invoice (Stock Deducted)' : isQuotation ? '🟣 Quotation (No Stock Effect)' : (hasShortages ? '⚠️ Standard Order (Shortage Queued)' : '🟢 Standard Order (100% In-Stock Reserved)')}
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
            ${isInvoice ? `
              <div class="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded p-2 text-xs text-blue-800 dark:text-blue-200 font-medium">
                📄 Official GST Tax Invoice posted. Warehouse stock ledger has been atomically updated.
              </div>
            ` : ''}
            ${!isInvoice && !isQuotation && hasShortages ? `
              <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded p-2 text-xs text-amber-800 dark:text-amber-200 font-medium">
                ⚙️ Status: <strong>Shortage (Production Required)</strong>. Deficit items have been queued in the Centralized Production Requirement list.
              </div>
            ` : ''}
            ${!isInvoice && !isQuotation && !hasShortages ? `
              <div class="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded p-2 text-xs text-emerald-800 dark:text-emerald-200 font-medium">
                ✓ Free stock has been reserved for this customer order. Ready to invoice and dispatch.
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
        showDenyButton: !isInvoice && !isQuotation && hasShortages,
        confirmButtonText: 'Create Another Order',
        denyButtonText: '📋 View Production Requirements',
        cancelButtonText: 'Close',
        confirmButtonColor: '#2563eb',
        denyButtonColor: '#4f46e5'
      }).then((result) => {
        if (result.isDenied) {
          navigate('/production/requirements');
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
    if (isDocumentLocked) {
      Swal.fire({
        icon: 'error',
        title: 'Document Locked (Immutable)',
        text: lockedReason || 'This document has already been converted and cannot be changed, edited, or updated.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

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

    // Check whether any modifications were made when in edit mode
    if (editOrderId && initialSnapshot) {
      const currentSnap = JSON.stringify({
        customerId: customerId || '',
        customerRefNo: customerRefNo || '',
        contactPerson: contactPerson || '',
        shipToAddress: shipToAddress || '',
        billToAddress: billToAddress || '',
        docSeries: docSeries || 'Primary',
        orderMode: orderMode || 'STANDARD',
        docStatus: docStatus || 'Open',
        postingDate: parseDMYtoYMD(postingDate) || '',
        deliveryDate: parseDMYtoYMD(deliveryDate) || '',
        documentDate: parseDMYtoYMD(documentDate) || '',
        salesEmployee: salesEmployee || '-No Sales Employee-',
        remarks: (remarks || '').replace(/\[\[ATTACHMENT:.*?\]\]/g, '').replace(/\[Fulfillment Mode:.*?\]/g, '').trim(),
        orderTerms: (orderTerms || '').trim(),
        attachments: (attachments || []).map(a => a.url || a.filename || '').sort().join(','),
        discountPercent: Number(discountPercent || 0),
        freight: Number(freight || 0),
        loadingCharges: Number(loadingCharges || 0),
        packingCharges: Number(packingCharges || 0),
        otherCharges: Number(otherCharges || 0),
        shippingMethod: shippingMethod || 'Road Transport',
        transporterName: transporterName || '',
        vehicleNo: vehicleNo || '',
        lrNo: lrNo || '',
        ewayBillNo: ewayBillNo || '',
        paymentTerms: paymentTerms || 'Not Paid',
        paymentMethod: paymentMethod || 'Bank Transfer / NEFT',
        advancePaid: Number(advancePaid || 0),
        placeOfSupply: placeOfSupply || '33',
        lines: activeLines.map(l => ({
          productId: l.productId || null,
          rawMaterialId: l.rawMaterialId || null,
          itemType: l.itemType || (l.rawMaterialId ? 'RAW_MATERIAL' : 'PRODUCT'),
          isPackingCharge: Boolean(l.isPackingCharge),
          quantity: Number(l.quantity || 1),
          unitPrice: Number(l.unitPrice || 0),
          discountPercent: Number(l.discountPercent || 0),
          gstRate: Number(l.gstRate || 5)
        })).sort((a, b) => ((a.productId || a.rawMaterialId || '')).localeCompare(b.productId || b.rawMaterialId || ''))
      });

      if (currentSnap === initialSnapshot) {
        setStatusMessage({
          type: 'info',
          text: 'ℹ Nothing changed - No modifications were made to this order.'
        });
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

    // Commercial Rule: INVOICE Mode requires 100% available warehouse stock!
    // Standard Orders accept customer commitments with back-orders and never block.
    if (orderMode === 'INVOICE' && stockDeficitSummary.hasShortages) {
      setStatusMessage({
        type: 'error',
        text: `✖ Cannot post Invoice: Insufficient stock for ${stockDeficitSummary.shortageLines.map(l => l.itemDescription).join(', ')}.`
      });
      Swal.fire({
        icon: 'error',
        title: 'Invoice Posting Blocked: Insufficient Stock',
        html: `
          <div class="text-left text-xs space-y-2">
            <p class="text-slate-600 dark:text-slate-300">
              Tax Invoices require physical goods in warehouse stock before posting and dispatch. <strong>Stock cannot be deducted twice or go negative.</strong>
            </p>
            <div class="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded p-2.5 text-rose-900 dark:text-rose-200 font-mono text-[11px] space-y-1">
              ${stockDeficitSummary.shortageLines.map(l => `<div>• <strong>${l.itemDescription}</strong> (${l.systemCode}): Required <strong>${l.quantity}</strong>, Available <strong>${l.stock}</strong> (Short: <span class="text-rose-600 font-bold">-${l.deficit} ${l.unitOfSale}</span>)</div>`).join('')}
            </div>
            <p class="text-slate-700 dark:text-slate-300 font-semibold pt-1">
              Please adjust quantities to match available stock, or save as a Standard Order to route shortages to the Production Requirement list.
            </p>
          </div>
        `,
        confirmButtonText: 'Review Line Items',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    const isInvoice = orderMode === 'INVOICE';
    const isQuotation = orderMode === 'QUOTATION';

    const cleanDocNo = (docNo && docNo !== 'NaN' && !String(docNo).includes('NaN') && docNo !== 'Assigned on posting') ? docNo : undefined;

    const payload = {
      docNo: cleanDocNo,
      documentSeries: docSeries,
      sourceOrderId: sourceOrderId || convertFromId || undefined,
      type: isInvoice ? 'Invoice' : (isQuotation ? 'Quotation' : 'Sales Order'),
      orderMode: orderMode,
      status: isInvoice ? 'Delivered' : (isQuotation ? 'Quotation' : (stockDeficitSummary.hasShortages ? 'Shortage (Production Required)' : 'Ready to Invoice')),
      skipStockDeduction: false,
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
      internalNote: (() => {
        const cleanRemarks = (remarks || '')
          .replace(/\[\[ATTACHMENT:.*?\]\]/g, '')
          .replace(/\[\[PAYMENT_DETAILS:.*?\]\]/g, '')
          .replace(/\[\[TERMS_AND_CONDITIONS:.*?\]\]/g, '')
          .trim();
        const activePaymentDetails = paymentMethod.includes('Bank')
          ? bankTransferDetails
          : (paymentMethod.includes('UPI') ? upiDetails : (paymentMethod.includes('Card') ? cardDetails : cashDetails));
        const attJson = attachments.length > 0 ? `[[ATTACHMENT:${JSON.stringify(attachments)}]]` : '';
        const payJson = activePaymentDetails ? `[[PAYMENT_DETAILS:${JSON.stringify(activePaymentDetails)}]]` : '';
        const termsJson = orderTerms ? `[[TERMS_AND_CONDITIONS:${encodeURIComponent(orderTerms)}]]` : '';
        return [cleanRemarks, payJson, termsJson, attJson].filter(Boolean).join(' ');
      })(),
      attachmentUrl: attachments.length > 0 ? attachments.map(a => a.url).join(', ') : null,
      deliveryAddress: shipToAddress,
      shipToAddress: shipToAddress,
      billToAddress: billToAddress,
      billingAddress: billToAddress,
      shippingMethod: shippingMethod,
      transporterName: transporterName,
      vehicleNo: vehicleNo,
      lrNo: lrNo,
      ewayBillNo: ewayBillNo,
      paymentTerms: String(paymentTerms).toUpperCase() === 'PAID' ? 'PAID' : paymentTerms,
      paymentMethod: paymentMethod,
      paymentMode: paymentMethod,
      paymentStatus: String(paymentTerms).toUpperCase() === 'PAID' ? 'PAID' : (Number(advancePaid) > 0 ? 'PARTIAL' : 'PENDING'),
      paymentDetails: paymentMethod.includes('Bank')
        ? bankTransferDetails
        : (paymentMethod.includes('UPI') ? upiDetails : (paymentMethod.includes('Card') ? cardDetails : cashDetails)),
      termsAndConditions: orderTerms,
      amountPaid: Number(advancePaid) || 0,
      placeOfSupply: isInterState ? (placeOfSupply || '29') : sellerStateCode,
      sellerStateCode: sellerStateCode,
      buyerStateCode: isInterState ? (placeOfSupply || '29') : sellerStateCode,
      taxType: isInterState ? 'INTER_STATE' : 'INTRA_STATE',
      totalSubtotal: financials.taxableSubtotal,
      discountPercent: Number(discountPercent) || 0,
      discountValue: financials.docDiscAmt,
      invoiceDiscount: financials.docDiscAmt,
      freight: Number(freight) || 0,
      freightTaxCode: freightTaxCode,
      freightGst: getTaxRateFromCode(freightTaxCode) > 0,
      loadingCharges: Number(loadingCharges) || 0,
      loadingTaxCode: loadingTaxCode,
      loadingGst: getTaxRateFromCode(loadingTaxCode) > 0,
      packingCharges: Number(packingCharges) || 0,
      packingTaxCode: packingTaxCode,
      packingGst: getTaxRateFromCode(packingTaxCode) > 0,
      otherCharges: Number(otherCharges) || 0,
      otherTaxCode: otherTaxCode,
      otherGst: getTaxRateFromCode(otherTaxCode) > 0,
      collectTax: true,
      cgst: financials.cgst,
      sgst: financials.sgst,
      igst: financials.igst,
      totalTax: financials.totalTax,
      roundOff: financials.roundOff,
      grandTotal: financials.grandTotal,
      gstSlabs: financials.gstSlabs,
      items: activeLines.map(l => ({
        productId: l.productId || undefined,
        rawMaterialId: l.rawMaterialId || undefined,
        itemType: l.itemType || (l.rawMaterialId ? 'RAW_MATERIAL' : 'PRODUCT'),
        isPackingCharge: Boolean(l.isPackingCharge),
        batchAllocationsData: l.batchAllocations || [],
        sourceOrderItemId: l.sourceOrderItemId || undefined,
        productCode: l.systemCode || (l.rawMaterialId ? (l.rawMaterial?.code || l.rawMaterial?.sku) : (l.rawProduct?.code || l.rawProduct?.sku)) || '',
        systemCode: l.systemCode || (l.rawMaterialId ? (l.rawMaterial?.code || l.rawMaterial?.sku) : (l.rawProduct?.code || l.rawProduct?.sku)) || '',
        category: l.category || (l.rawMaterialId ? (l.rawMaterial?.category?.name || l.rawMaterial?.category) : (l.rawProduct?.category?.name || l.rawProduct?.categoryName)) || '',
        categoryName: l.category || (l.rawMaterialId ? (l.rawMaterial?.category?.name || l.rawMaterial?.category) : (l.rawProduct?.category?.name || l.rawProduct?.categoryName)) || '',
        productName: l.itemDescription,
        hsnCode: (l.rawMaterialId ? (l.rawMaterial?.hsnCode || '392310') : (l.rawProduct?.hsnCode || l.rawProduct?.specifications?.hsnCode)) || '21050000',
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discountPercent: Number(l.discountPercent) || 0,
        discount: Number(l.lineDiscount) || 0,
        gstRate: Number(l.gstRate) || (l.rawMaterialId ? 18 : 5),
        subtotal: Number(l.lineTotal),
        uomName: l.unitOfSale,
        deliveryDate: parseDMYtoYMD(deliveryDate) || new Date().toISOString().split('T')[0]
      }))
    };

    // Clean up any removed attachment files from server uploads
    if (removedAttachmentUrls.length > 0) {
      removedAttachmentUrls.forEach(url => {
        api.post('/orders/delete-attachment', {
          fileUrl: url,
          orderId: editOrderId,
          orderDocNo: docNo
        }).catch(() => {});
      });
    }

    createOrderMutation.mutate(payload);
  };

  // Workflow Conversion: Quotation -> Standard Order
  const handleConvertToOrderFromStudio = async () => {
    if (!editOrderId) return;
    if (isConvertedQuote) {
      Swal.fire({
        icon: 'info',
        title: 'Already Converted',
        text: `Quotation #${docNo} has already been converted to Sales Order #${convertedChildOrder?.docNo || 'SO'}.`,
        showCancelButton: true,
        confirmButtonText: convertedChildOrder ? `Open #${convertedChildOrder.docNo}` : 'View Flow',
        confirmButtonColor: '#2563eb'
      }).then(res => {
        if (res.isConfirmed) {
          if (convertedChildOrder) {
            navigate(`/sales/order?id=${convertedChildOrder.id}`);
          } else {
            setShowDocFlowModal(true);
          }
        }
      });
      return;
    }

    const confirm = await Swal.fire({
      title: 'Convert to Standard Order?',
      text: `Convert Quotation #${docNo} into a binding Standard Order and reserve warehouse stock.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Convert Now',
      confirmButtonColor: '#2563eb'
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await api.post(`/orders/${editOrderId}/convert-to-order`);
      Swal.fire({
        icon: 'success',
        title: 'Quotation Converted!',
        text: `Created Standard Order #${res.data?.docNo || res.data?.referenceNo}`,
        confirmButtonColor: '#2563eb'
      }).then(() => {
        navigate(`/sales/order?id=${res.data?.id}`);
      });
    } catch (err) {
      if (err?.response?.data?.alreadyConverted) {
        Swal.fire({
          icon: 'info',
          title: 'Already Converted',
          text: err.response.data.message || 'Quotation has already been converted to an order.',
          showCancelButton: true,
          confirmButtonText: err.response.data.convertedDocNo ? `Open Sales Order #${err.response.data.convertedDocNo}` : 'View Flow',
          confirmButtonColor: '#2563eb'
        }).then(res => {
          if (res.isConfirmed && err.response.data.convertedOrderId) {
            navigate(`/sales/order?id=${err.response.data.convertedOrderId}`);
          }
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Conversion Failed',
          text: err?.response?.data?.error || err.message
        });
      }
    }
  };

  // Workflow Conversion: Standard Order -> Tax Invoice
  const handleConvertToInvoiceFromStudio = async () => {
    if (!editOrderId) return;
    if (isInvoicedOrder) {
      Swal.fire({
        icon: 'info',
        title: 'Already Converted to Tax Invoice',
        text: `Sales Order #${docNo} has already been converted to Tax Invoice #${invoiceChildOrder?.docNo || invoiceChildOrder?.orderNumber || 'INV'}. Converted sales orders cannot be changed or edited.`,
        showCancelButton: true,
        confirmButtonText: invoiceChildOrder ? `Open #${invoiceChildOrder.docNo || invoiceChildOrder.orderNumber}` : 'View Flow',
        confirmButtonColor: '#2563eb'
      }).then(res => {
        if (res.isConfirmed) {
          if (invoiceChildOrder) {
            navigate(`/sales/order?id=${invoiceChildOrder.id}`);
          } else {
            setShowDocFlowModal(true);
          }
        }
      });
      return;
    }
    if (stockDeficitSummary.hasShortages) {
      Swal.fire({
        icon: 'error',
        title: 'Cannot Convert to Invoice: Stock Deficit',
        text: `There is a shortage on ${stockDeficitSummary.shortageLines.length} item(s). Invoices strictly require 100% available stock. Please fulfill stock via production first.`,
        confirmButtonColor: '#2563eb'
      });
      return;
    }
    const confirm = await Swal.fire({
      title: 'Post Tax Invoice?',
      text: `Posting invoice will assign an official GST Tax Invoice Number and permanently deduct stock.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Post Invoice',
      confirmButtonColor: '#2563eb'
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await api.post(`/orders/${editOrderId}/convert-to-invoice`, {
        items: activeLines.map(l => ({
          productId: l.productId || undefined,
          rawMaterialId: l.rawMaterialId || undefined,
          itemType: l.itemType || (l.rawMaterialId ? 'RAW_MATERIAL' : 'PRODUCT'),
          isPackingCharge: Boolean(l.isPackingCharge),
          batchAllocationsData: l.batchAllocations || [],
          productName: l.itemDescription,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discountPercent: Number(l.discountPercent) || 0,
          discount: Number(l.lineDiscount) || 0,
          gstRate: Number(l.gstRate) || (l.rawMaterialId ? 18 : 5),
          subtotal: Number(l.lineTotal),
          uomName: l.unitOfSale
        }))
      });
      Swal.fire({
        icon: 'success',
        title: 'Tax Invoice Posted!',
        text: `Invoice #${res.data?.docNo || res.data?.invoiceNo} created. Stock deducted successfully.`,
        confirmButtonColor: '#2563eb'
      }).then(() => {
        handlePrintPDF(res.data);
        navigate('/sales/list');
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Invoice Conversion Failed',
        text: err?.response?.data?.error || err.message
      });
    }
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
    setRemovedAttachmentUrls([]);
    setDiscountPercent(0);
    setDiscountAmountInput(0);
    setDiscountMode('percent');
    setFreight(0);
    setLoadingCharges(0);
    setPackingCharges(0);
    setOtherCharges(0);
    setAdvancePaid(0);
    fetchNextDocNo(orderMode);
    setStatusMessage({
      type: 'ready',
      text: '✔ Form reset - ready for new document'
    });
  };

  // Generate & Print A4 PDF
  const handlePrintPDF = async (orderPayload) => {
    const isPaid = String(paymentTerms).toUpperCase() === 'PAID' || 
                   (Number(advancePaid) >= Number(financials.grandTotal) && Number(financials.grandTotal) > 0);
    const activePaymentDetails = paymentMethod.includes('Bank')
      ? bankTransferDetails
      : (paymentMethod.includes('UPI') ? upiDetails : (paymentMethod.includes('Card') ? cardDetails : cashDetails));

    const orderData = orderPayload || {
      docNo: docNo,
      referenceNo: (docNo && (docNo.startsWith('SO-') || docNo.startsWith('INV-') || docNo.startsWith('QT-'))) ? docNo : `SO-${docNo}`,
      type: orderMode === 'INVOICE' ? 'Invoice' : (orderMode === 'QUOTATION' ? 'Quotation' : 'Sales Order'),
      createdAt: postingDate,
      deliveryDate: deliveryDate,
      customer: selectedCustomer || {
        name: 'Valued Customer',
        address: shipToAddress || billToAddress,
        gstin: taxRegNo,
        phone: contactPerson
      },
      customerName: selectedCustomer?.name,
      customerPhone: contactPerson || selectedCustomer?.phone,
      shipToAddress: shipToAddress || selectedCustomer?.address || billToAddress,
      billToAddress: billToAddress || selectedCustomer?.billingAddress || selectedCustomer?.address,
      deliveryAddress: shipToAddress || billToAddress || selectedCustomer?.address,
      buyerStateCode: isInterState ? (placeOfSupply || '29') : sellerStateCode,
      sellerStateCode: sellerStateCode,
      placeOfSupply: placeOfSupply,
      taxType: isInterState ? 'INTER_STATE' : 'INTRA_STATE',
      shippingMethod: shippingMethod,
      transporterName: transporterName,
      vehicleNo: vehicleNo,
      lrNo: lrNo,
      ewayBillNo: ewayBillNo,
      salesEmployee: salesEmployee,
      owner: owner,
      customerRefNo: customerRefNo,
      paymentTerms: isPaid ? 'PAID' : paymentTerms,
      paymentStatus: isPaid ? 'PAID' : (Number(advancePaid) > 0 ? 'PARTIAL' : 'PENDING'),
      paymentMethod: paymentMethod,
      paymentMode: paymentMethod,
      paymentDetails: activePaymentDetails,
      termsAndConditions: orderTerms,
      invoiceTerms: orderTerms,
      amountPaid: advancePaid,
      items: activeLines.map(l => ({
        productId: l.productId,
        rawMaterialId: l.rawMaterialId,
        itemType: l.itemType || (l.rawMaterialId ? 'RAW_MATERIAL' : 'PRODUCT'),
        isPackingCharge: Boolean(l.isPackingCharge),
        is_packing_charge: Boolean(l.isPackingCharge),
        productCode: l.systemCode || (l.rawMaterialId ? (l.rawMaterial?.code || l.rawMaterial?.sku) : (l.rawProduct?.code || l.rawProduct?.sku)) || '',
        systemCode: l.systemCode || (l.rawMaterialId ? (l.rawMaterial?.code || l.rawMaterial?.sku) : (l.rawProduct?.code || l.rawProduct?.sku)) || '',
        itemCode: l.systemCode || (l.rawMaterialId ? (l.rawMaterial?.code || l.rawMaterial?.sku) : (l.rawProduct?.code || l.rawProduct?.sku)) || '',
        category: l.category || (l.rawMaterialId ? (l.rawMaterial?.category?.name || l.rawMaterial?.category) : (l.rawProduct?.category?.name || l.rawProduct?.categoryName)) || '',
        categoryName: l.category || (l.rawMaterialId ? (l.rawMaterial?.category?.name || l.rawMaterial?.category) : (l.rawProduct?.category?.name || l.rawProduct?.categoryName)) || '',
        productName: l.itemDescription,
        hsnCode: (l.rawMaterialId ? (l.rawMaterial?.hsnCode || '392310') : (l.rawProduct?.hsnCode || l.rawProduct?.specifications?.hsnCode)) || '21050000',
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discountPercent: Number(l.discountPercent) || 0,
        subtotal: Number(l.lineTotal),
        gstRate: Number(l.gstRate) || (l.rawMaterialId ? 18 : 5),
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
      totalTax: financials.totalTax,
      roundOff: financials.roundOff,
      grandTotal: financials.grandTotal,
      gstSlabs: financials.gstSlabs,
      internalNote: remarks
    };

    try {
      let liveCompany = storeCompany;
      try {
        const taxRes = await api.get('/setup/tax');
        if (taxRes.data) {
          liveCompany = taxRes.data;
          useCompanyStore.getState().setCompany(taxRes.data);
        }
      } catch (taxErr) {
        console.warn('Could not refresh setup tax, using store company:', taxErr);
      }

      const blob = generateA4TaxInvoice(orderData, liveCompany);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getSalesDocumentPdfFilename(orderData, 'A4');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      console.error('Error generating PDF:', e);
      Swal.fire({
        icon: 'error',
        title: 'PDF Generation Error',
        text: e.message
      });
    }
  };

  // WhatsApp Share with Live Bill PDF Generation, Download & Link
  const handleShareWhatsApp = async (orderPayload) => {
    const isPaid = String(paymentTerms).toUpperCase() === 'PAID' || 
                   (Number(advancePaid) >= Number(financials.grandTotal) && Number(financials.grandTotal) > 0);
    const activePaymentDetails = paymentMethod.includes('Bank')
      ? bankTransferDetails
      : (paymentMethod.includes('UPI') ? upiDetails : (paymentMethod.includes('Card') ? cardDetails : cashDetails));

    const orderData = orderPayload || {
      id: editOrderId,
      docNo: docNo,
      referenceNo: (docNo && (docNo.startsWith('SO-') || docNo.startsWith('INV-') || docNo.startsWith('QT-'))) ? docNo : `SO-${docNo}`,
      type: orderMode === 'INVOICE' ? 'Invoice' : (orderMode === 'QUOTATION' ? 'Quotation' : 'Sales Order'),
      createdAt: postingDate,
      deliveryDate: deliveryDate,
      customer: selectedCustomer || {
        name: 'Valued Customer',
        address: shipToAddress || billToAddress,
        gstin: taxRegNo,
        phone: contactPerson
      },
      customerName: selectedCustomer?.name,
      customerPhone: contactPerson || selectedCustomer?.phone,
      shipToAddress: shipToAddress || selectedCustomer?.address || billToAddress,
      billToAddress: billToAddress || selectedCustomer?.billingAddress || selectedCustomer?.address,
      deliveryAddress: shipToAddress || billToAddress || selectedCustomer?.address,
      buyerStateCode: isInterState ? (placeOfSupply || '29') : sellerStateCode,
      sellerStateCode: sellerStateCode,
      placeOfSupply: placeOfSupply,
      taxType: isInterState ? 'INTER_STATE' : 'INTRA_STATE',
      shippingMethod: shippingMethod,
      transporterName: transporterName,
      vehicleNo: vehicleNo,
      lrNo: lrNo,
      ewayBillNo: ewayBillNo,
      salesEmployee: salesEmployee,
      owner: owner,
      customerRefNo: customerRefNo,
      paymentTerms: isPaid ? 'PAID' : paymentTerms,
      paymentStatus: isPaid ? 'PAID' : (Number(advancePaid) > 0 ? 'PARTIAL' : 'PENDING'),
      paymentMethod: paymentMethod,
      paymentMode: paymentMethod,
      paymentDetails: activePaymentDetails,
      termsAndConditions: orderTerms,
      invoiceTerms: orderTerms,
      amountPaid: advancePaid,
      items: activeLines.map(l => ({
        productId: l.productId,
        rawMaterialId: l.rawMaterialId,
        itemType: l.itemType || (l.rawMaterialId ? 'RAW_MATERIAL' : 'PRODUCT'),
        isPackingCharge: Boolean(l.isPackingCharge),
        is_packing_charge: Boolean(l.isPackingCharge),
        productCode: l.systemCode || (l.rawMaterialId ? (l.rawMaterial?.code || l.rawMaterial?.sku) : (l.rawProduct?.code || l.rawProduct?.sku)) || '',
        systemCode: l.systemCode || (l.rawMaterialId ? (l.rawMaterial?.code || l.rawMaterial?.sku) : (l.rawProduct?.code || l.rawProduct?.sku)) || '',
        itemCode: l.systemCode || (l.rawMaterialId ? (l.rawMaterial?.code || l.rawMaterial?.sku) : (l.rawProduct?.code || l.rawProduct?.sku)) || '',
        category: l.category || (l.rawMaterialId ? (l.rawMaterial?.category?.name || l.rawMaterial?.category) : (l.rawProduct?.category?.name || l.rawProduct?.categoryName)) || '',
        categoryName: l.category || (l.rawMaterialId ? (l.rawMaterial?.category?.name || l.rawMaterial?.category) : (l.rawProduct?.category?.name || l.rawProduct?.categoryName)) || '',
        productName: l.itemDescription,
        hsnCode: (l.rawMaterialId ? (l.rawMaterial?.hsnCode || '392310') : (l.rawProduct?.hsnCode || l.rawProduct?.specifications?.hsnCode)) || '21050000',
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discountPercent: Number(l.discountPercent) || 0,
        subtotal: Number(l.lineTotal),
        gstRate: Number(l.gstRate) || (l.rawMaterialId ? 18 : 5),
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

    let rawPhone = orderData.customerPhone || orderData.customer?.phone || contactPerson;
    if (!rawPhone) {
      const { value: enteredPhone } = await Swal.fire({
        title: 'Enter Recipient Mobile',
        input: 'text',
        inputLabel: 'Customer phone number for WhatsApp delivery',
        placeholder: 'e.g. 9876543210',
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        inputValidator: (val) => (!val ? 'Please enter a valid phone number' : null)
      });
      if (!enteredPhone) return;
      rawPhone = enteredPhone;
    }

    let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    let liveCompany = storeCompany;
    try {
      const taxRes = await api.get('/setup/tax');
      if (taxRes.data) {
        liveCompany = taxRes.data;
        useCompanyStore.getState().setCompany(taxRes.data);
      }
    } catch (taxErr) {
      console.warn('Could not refresh setup tax, using store company:', taxErr);
    }

    // 1. Generate and automatically download the official printable A4 PDF
    const pdfFilename = getSalesDocumentPdfFilename(orderData, 'A4');
    try {
      const blob = generateA4TaxInvoice(orderData, liveCompany);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    } catch (pdfErr) {
      console.warn('PDF generation for WhatsApp failed:', pdfErr);
    }

    // 2. Prepare Direct Public PDF Link
    const apiBase = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:5000/api' : `${window.location.origin}/api`);
    const baseUrl = apiBase.startsWith('http') ? apiBase : `${window.location.origin}${apiBase}`;
    const publicPdfUrl = orderData.id ? `${baseUrl}/public/orders/${orderData.id}/pdf` : `${baseUrl}/public/orders/pdf`;

    // 3. Construct attractive itemized WhatsApp message
    const printableLines = (orderData.items || []).filter(i => !i.isPackingCharge && !i.is_packing_charge);
    const itemLines = printableLines.slice(0, 8).map((it, idx) => {
      const isRM = Boolean(it.rawMaterialId || it.itemType === 'RAW_MATERIAL');
      const tag = isRM ? '🟣 [RM]' : '🟢 [FG]';
      const name = it.productName || it.itemDescription || 'Item';
      const qty = Number(it.quantity || 1);
      const uom = it.uomName || (isRM ? 'kg' : 'pcs');
      const rate = Number(it.unitPrice || 0);
      const lineSub = Number(it.subtotal || (qty * rate));
      return `${idx + 1}. ${tag} *${name}*\n   ${qty} ${uom} × ₹${rate.toFixed(2)} = ₹${lineSub.toFixed(2)}`;
    }).join('\n');

    const extraItemsCount = printableLines.length - 8;
    const extraItemsText = extraItemsCount > 0 ? `\n...and ${extraItemsCount} more items in PDF` : '';

    const grandTotalFormatted = Number(orderData.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const amountInWords = numberToWordsINR(Number(orderData.grandTotal || 0));

    // Dynamic Product & Charges breakdown
    const waProductAmt = printableLines.reduce((s, it) => s + Number(it.subtotal || (Number(it.quantity || 1) * Number(it.unitPrice || 0))), 0);
    const waDisc = Number(orderData.discountValue || orderData.invoiceDiscount || 0);
    const waFreight = Number(orderData.freight || 0);
    const waPacking = Number(orderData.packingCharges || 0);
    const waLoading = Number(orderData.loadingCharges || 0);
    const waOther = Number(orderData.otherCharges || 0);

    const waActiveCharges = [];
    if (waPacking > 0) waActiveCharges.push('Packing');
    if (waLoading > 0) waActiveCharges.push('Loading');
    if (waFreight > 0) waActiveCharges.push('Freight');
    if (waOther > 0) waActiveCharges.push('Other Charges');

    let waProductAndChargesLabel = 'Total Product Amount';
    if (waActiveCharges.length === 1) {
      waProductAndChargesLabel = `Total Product & ${waActiveCharges[0]} Amount`;
    } else if (waActiveCharges.length === 2) {
      waProductAndChargesLabel = `Total Product, ${waActiveCharges[0]} & ${waActiveCharges[1]}`;
    } else if (waActiveCharges.length > 2) {
      waProductAndChargesLabel = 'Total Product & Charges Amount';
    }

    const waTotalProductAndCharges = Math.max(0, waProductAmt - waDisc) + waFreight + waPacking + waLoading + waOther;

    const waIsInterState = String(orderData.placeOfSupply || '33') !== '33';
    const waSlabs = computeOrderGstSlabs(orderData, waIsInterState);
    let waTaxLines = '';
    if (waSlabs && waSlabs.length > 0) {
      if (!waIsInterState) {
        waTaxLines = waSlabs.map(s => 
          `• CGST ${s.halfRate}% : ₹${s.cgstAmount.toFixed(2)}\n• SGST ${s.halfRate}% : ₹${s.sgstAmount.toFixed(2)}`
        ).join('\n');
      } else {
        waTaxLines = waSlabs.map(s => 
          `• IGST ${s.rate}% : ₹${s.igstAmount.toFixed(2)}`
        ).join('\n');
      }
      const totalTaxSum = waSlabs.reduce((sum, s) => sum + s.totalTax, 0);
      waTaxLines += `\n• Total GST Tax : ₹${totalTaxSum.toFixed(2)}`;
    } else {
      const totalTax = Number(orderData.cgst || 0) + Number(orderData.sgst || 0) + Number(orderData.igst || 0);
      if (!waIsInterState) {
        if (Number(orderData.cgst || 0) > 0) waTaxLines += `• CGST Tax : ₹${Number(orderData.cgst).toFixed(2)}\n`;
        if (Number(orderData.sgst || 0) > 0) waTaxLines += `• SGST Tax : ₹${Number(orderData.sgst).toFixed(2)}\n`;
      } else {
        if (Number(orderData.igst || 0) > 0) waTaxLines += `• IGST Tax : ₹${Number(orderData.igst).toFixed(2)}\n`;
      }
      if (totalTax > 0) waTaxLines += `• Total GST Tax : ₹${totalTax.toFixed(2)}`;
    }

    const text = `🧾 *${orderData.type ? orderData.type.toUpperCase() : 'TAX INVOICE'}*
🏢 *${liveCompany?.companyName || 'LEONEX'}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 *Doc No:* ${orderData.docNo || orderData.referenceNo}
📅 *Date:* ${new Date(orderData.createdAt || Date.now()).toLocaleDateString('en-GB')}
👤 *Party:* ${orderData.customerName || orderData.customer?.name || 'Valued Client'}
📞 *Phone:* ${rawPhone}
🏛️ *GSTIN:* ${orderData.customer?.gstin || orderData.taxRegNo || 'URP'}
📍 *Place of Supply:* ${orderData.placeOfSupply ? orderData.placeOfSupply : 'Intra-State'}

📦 *ITEMIZED BILL SUMMARY:*
${itemLines}${extraItemsText}

💵 *FINANCIAL BREAKDOWN:*
• Total Product Amount : ₹${waProductAmt.toFixed(2)}
${waDisc > 0 ? `• Discount : -₹${waDisc.toFixed(2)}\n` : ''}${waFreight > 0 ? `• Freight & Logistics (${getChargeBadgeText(freightTaxCode)}) : ₹${waFreight.toFixed(2)}\n` : ''}${waPacking > 0 ? `• Package Charges (${getChargeBadgeText(packingTaxCode)}) : ₹${waPacking.toFixed(2)}\n` : ''}${waLoading > 0 ? `• Loading Charges (${getChargeBadgeText(loadingTaxCode)}) : ₹${waLoading.toFixed(2)}\n` : ''}${waOther > 0 ? `• Other Charges (${getChargeBadgeText(otherTaxCode)}) : ₹${waOther.toFixed(2)}\n` : ''}• *${waProductAndChargesLabel}* : ₹${waTotalProductAndCharges.toFixed(2)}
${waTaxLines ? `${waTaxLines}\n` : ''}• Round-Off : ${Number(orderData.roundOff || 0) < 0 ? `-₹${Math.abs(Number(orderData.roundOff)).toFixed(2)}` : `+₹${Number(orderData.roundOff || 0).toFixed(2)}`}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *NET GRAND TOTAL: ₹${grandTotalFormatted}*
🗣️ _${amountInWords}_
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 *PAYMENT SETTLEMENT:*
• Mode : ${orderData.paymentMode || orderData.paymentMethod || orderData.paymentTerms || 'Bank Transfer'}
• Status : ${orderData.paymentStatus || 'PENDING'}

📥 *DOWNLOAD / VIEW PRINTABLE BILL PDF:*
${publicPdfUrl}

Thank you for choosing *${liveCompany?.companyName || 'LEONEX'}*!
For queries, contact ${liveCompany?.companyMobile || '+91 99404 54154'}`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');

    Swal.fire({
      icon: 'success',
      title: 'WhatsApp Dispatched & Bill PDF Downloaded',
      html: `
        <div class="text-left text-xs text-slate-600 dark:text-slate-300 space-y-2 pt-1">
          <div class="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-200">
            ✅ <b>Bill PDF Downloaded:</b> <span class="font-mono font-semibold">${pdfFilename}</span>
          </div>
          <p>WhatsApp Web has been opened with your bill summary and direct PDF download link.</p>
          <div class="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg text-indigo-800 dark:text-indigo-200">
            📎 <b>Send File on WhatsApp:</b> You can drag & drop the downloaded <b>${pdfFilename}</b> file directly into your WhatsApp chat window to send the official PDF document as an attachment!
          </div>
        </div>
      `,
      confirmButtonColor: '#16a34a',
      timer: 5000,
      timerProgressBar: true
    });
  };

  // Email Document Dispatch directly from Studio
  const handleResendEmail = async () => {
    if (!editOrderId) {
      Swal.fire({
        icon: 'info',
        title: 'Save Document First',
        text: 'Please save or post the document before dispatching statutory email.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    const defaultEmail = selectedCustomer?.email || 'mathansethupathy@gmail.com';
    const { value: targetEmail } = await Swal.fire({
      title: 'Dispatch Statutory Email',
      html: `
        <div class="text-left text-xs text-slate-600 dark:text-slate-300 space-y-2">
          <p>This will dispatch an executive HTML email with the statutory PDF invoice attached, featuring complete item lines, tax calculations, amount in words, bank details, and terms.</p>
          <div class="p-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded text-indigo-800 dark:text-indigo-200">
            📄 <b>Document:</b> ${docNo} &bull; <b>Total:</b> ₹${Number(financials.grandTotal || 0).toFixed(2)}
          </div>
        </div>
      `,
      input: 'email',
      inputValue: defaultEmail,
      inputLabel: 'Recipient Email Address',
      showCancelButton: true,
      confirmButtonText: '📧 Dispatch Email',
      confirmButtonColor: '#4f46e5',
      inputValidator: (val) => (!val ? 'Please enter a valid email address' : null)
    });

    if (!targetEmail) return;

    try {
      Swal.fire({
        title: 'Sending Statutory Email...',
        text: `Transmitting document ${docNo} to ${targetEmail} with PDF attachment...`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const res = await api.post(`/orders/${editOrderId}/resend`, { targetEmail });
      Swal.fire({
        icon: 'success',
        title: 'Email Dispatched Successfully',
        text: res.data?.message || `Statutory PDF invoice dispatched to ${targetEmail}`,
        confirmButtonColor: '#4f46e5'
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Email Dispatch Failed',
        text: err?.response?.data?.error || err.message,
        confirmButtonColor: '#dc2626'
      });
    }
  };

  // Pre-indexed products with useMemo for high-performance instant searching
  const productsWithSearchIndex = useMemo(() => {
    return products.map(p => ({
      product: p,
      index: createProductSearchIndex(p)
    }));
  }, [products]);

  // In-Grid Screened & Filtered Products (Base Category -> Subcategory -> Multi-Token Fuzzy Search)
  const gridFilteredProducts = useMemo(() => {
    let pool = productsWithSearchIndex;

    // Filter by Base Category
    if (gridSelectedBaseCategory !== 'All') {
      pool = pool.filter(item => getProductCategory(item.product) === gridSelectedBaseCategory);
    }

    // Filter by Subcategory
    if (gridSelectedSubcategory !== 'All') {
      pool = pool.filter(item => getProductSubcategory(item.product) === gridSelectedSubcategory);
    }

    // Filter & rank by Search Query
    if (gridSearchQuery.trim()) {
      const q = gridSearchQuery.trim();
      const scored = [];
      for (let i = 0; i < pool.length; i++) {
        const item = pool[i];
        const res = matchProductSearch(item.index, q);
        if (res.matched) {
          scored.push({
            product: item.product,
            score: res.score
          });
        }
      }

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return getProductSystemCode(a.product).localeCompare(getProductSystemCode(b.product));
      });

      return scored.slice(0, 100).map(s => s.product);
    }

    return pool.slice(0, 60).map(item => item.product);
  }, [productsWithSearchIndex, gridSearchQuery, gridSelectedBaseCategory, gridSelectedSubcategory]);

  // Filtered Catalog Items for Modal Browser (respecting 2-tier screening + optimized multi-field search)
  const filteredCatalogItems = useMemo(() => {
    let pool = productsWithSearchIndex;

    if (selectedBaseCategory !== 'All') {
      pool = pool.filter(item => getProductCategory(item.product) === selectedBaseCategory);
    }

    if (selectedSubcategory !== 'All') {
      pool = pool.filter(item => getProductSubcategory(item.product) === selectedSubcategory);
    }

    if (searchCatalogQuery.trim()) {
      const q = searchCatalogQuery.trim();
      const scored = [];
      for (let i = 0; i < pool.length; i++) {
        const item = pool[i];
        const res = matchProductSearch(item.index, q);
        if (res.matched) {
          scored.push({
            product: item.product,
            score: res.score
          });
        }
      }

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return getProductSystemCode(a.product).localeCompare(getProductSystemCode(b.product));
      });

      return scored.map(s => s.product);
    }

    return pool.map(item => item.product);
  }, [productsWithSearchIndex, selectedBaseCategory, selectedSubcategory, searchCatalogQuery]);

  // Filtered Raw Materials for In-Grid Search (System Code, Name, Category)
  const gridFilteredRawMaterials = useMemo(() => {
    let pool = rawMaterials;
    if (gridSearchQuery.trim()) {
      const q = gridSearchQuery.toLowerCase().trim();
      pool = pool.filter(rm => 
        (rm.code || '').toLowerCase().includes(q) ||
        (rm.name || '').toLowerCase().includes(q) ||
        (rm.category?.name || rm.category || '').toLowerCase().includes(q)
      );
    }
    return pool.slice(0, 80);
  }, [rawMaterials, gridSearchQuery]);

  // Filtered Raw Materials for Catalog Modal Browser
  const filteredCatalogRawMaterials = useMemo(() => {
    let pool = rawMaterials;
    if (searchCatalogQuery.trim()) {
      const q = searchCatalogQuery.toLowerCase().trim();
      pool = pool.filter(rm => 
        (rm.code || '').toLowerCase().includes(q) ||
        (rm.name || '').toLowerCase().includes(q) ||
        (rm.category?.name || rm.category || '').toLowerCase().includes(q)
      );
    }
    return pool;
  }, [rawMaterials, searchCatalogQuery]);

  return (
    <div className={`sap-doc-container w-full bg-[var(--sap-bg-window)] text-[var(--sap-text)] font-sans text-xs antialiased selection:bg-amber-300 selection:text-slate-900 flex flex-col ${
      isFullscreen 
        ? 'fixed inset-0 z-[9999] w-screen h-screen overflow-y-auto' 
        : 'min-h-screen'
    }`}>
      <style>{sapStyles}</style>

      {/* FULL SCREEN DOCUMENT WINDOW HEADER */}
      <div className="w-full bg-[var(--sap-titlebar)] text-[var(--sap-titlebar-text)] px-4 py-2 flex items-center justify-between select-none border-b border-[var(--sap-border-inner)] shadow-sm">
        <div className="flex items-center gap-2.5 font-bold text-sm tracking-wide">
          <span className="text-amber-400 text-base">📋</span>
          <span>{editOrderId ? `Edit Order #${docNo || editOrderId}` : 'Sales Order'}</span>
          <span className="text-xs font-normal text-slate-300 opacity-80 pl-2.5 border-l border-slate-600">
            Enterprise Document Studio • {editOrderId ? 'Update Mode' : 'Full View'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {editOrderId && (
            <button
              type="button"
              onClick={() => navigate(searchParams.get('from') || '/sales/list')}
              className="px-2.5 py-1 text-xs rounded-xs flex items-center gap-1 font-bold text-slate-200 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 cursor-pointer shadow-xs mr-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sales Records</span>
            </button>
          )}
          {/* Active Sync Stock Button with Animated Spinner & Status Feedback */}
          <button
            type="button"
            disabled={isSyncingStock}
            onClick={handleSyncStock}
            className={`px-2.5 py-1 text-xs rounded-xs flex items-center gap-1.5 font-bold transition-all cursor-pointer shadow-xs ${
              isSyncingStock
                ? 'bg-amber-600 text-slate-950 opacity-90'
                : 'bg-slate-700 hover:bg-slate-600 text-amber-300 hover:text-amber-200 border border-slate-600'
            }`}
            title="Synchronize Live Warehouse Inventory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingStock ? 'animate-spin text-slate-950' : 'text-amber-300'}`} />
            <span>{isSyncingStock ? 'Syncing...' : 'Sync Stock'}</span>
          </button>

          {/* Full Screen Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleFullScreen}
            className={`px-2.5 py-1 text-xs rounded-xs flex items-center gap-1.5 font-bold transition-all cursor-pointer shadow-xs ${
              isFullscreen
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600'
            }`}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen (F11 / Immersive Full View)'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-slate-950 font-bold" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Full Screen'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCatalogModal(true)}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title={`Browse ${products.length} Finished Products`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Product Catalog ({products.length} Items)</span>
            {lastStockSyncTime && (
              <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse" title="Live Stock Synced" />
            )}
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
      <div className="w-full bg-slate-900 border-b border-slate-700 px-4 py-2 flex items-center justify-between gap-3 shadow-inner select-none">
        {/* Left: Mode Title */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-sm border border-amber-500/20">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Commercial Order Mode:</span>
          </span>
        </div>

        {/* Right: 3 Mode Buttons (Quotation / Standard Order / Invoice) */}
        <div className="flex items-center gap-2">
          {/* Mode 1: Quotation (Price Quote) */}
          <button
            type="button"
            onClick={() => {
              setOrderMode('QUOTATION');
              fetchNextDocNo('QUOTATION');
              setStatusMessage({
                type: 'ready',
                text: '🟣 Quotation Mode: Commercial price quotation without inventory reservation or stock deduction.'
              });
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              orderMode === 'QUOTATION'
                ? 'bg-purple-500 text-white shadow-md ring-2 ring-purple-300'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
            title="Quotation: Commercial price offer for customer approval. Zero stock effect."
          >
            <Sparkles className={`w-3.5 h-3.5 ${orderMode === 'QUOTATION' ? 'text-white font-black' : 'text-purple-400'}`} />
            <span>Quotation</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
              orderMode === 'QUOTATION'
                ? 'bg-white/20 text-white'
                : 'bg-purple-950/60 text-purple-300 border border-purple-800'
            }`}>
              No Stock Effect
            </span>
          </button>

          {/* Mode 2: Standard Order (Reserves Stock, Shortage Allowed) */}
          <button
            type="button"
            onClick={() => {
              setOrderMode('STANDARD');
              fetchNextDocNo('STANDARD');
              setStatusMessage({
                type: 'ready',
                text: '🟢 Standard Order Mode: Customer commitment accepted. Reserves available free stock; shortages route to Production.'
              });
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              orderMode === 'STANDARD'
                ? 'bg-emerald-500 text-slate-950 shadow-md ring-2 ring-emerald-300'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
            title="Standard Order: Accept customer order. Free stock is reserved, deficits shown in red and sent to production."
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${orderMode === 'STANDARD' ? 'text-slate-950 font-black' : 'text-emerald-400'}`} />
            <span>Standard Order</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
              orderMode === 'STANDARD'
                ? 'bg-slate-950/20 text-slate-950'
                : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
            }`}>
              Reserves Stock, Shortage Allowed
            </span>
          </button>

          {/* Mode 3: Invoice (Deducts Stock, Must Be In Stock) */}
          <button
            type="button"
            onClick={() => {
              setOrderMode('INVOICE');
              fetchNextDocNo('INVOICE');
              setStatusMessage({
                type: 'ready',
                text: '🔵 Tax Invoice Mode: Physical billing & dispatch. Deducts warehouse stock. Blocked if items are short.'
              });
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              orderMode === 'INVOICE'
                ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
            title="Invoice: Legal Tax Invoice. Reduces warehouse stock upon posting. Blocked if any stock item is short."
          >
            <FileText className={`w-3.5 h-3.5 ${orderMode === 'INVOICE' ? 'text-white font-black' : 'text-blue-400'}`} />
            <span>Invoice</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
              orderMode === 'INVOICE'
                ? 'bg-white/20 text-white'
                : 'bg-blue-950/60 text-blue-300 border border-blue-800'
            }`}>
              Deducts Stock, Must Be In Stock
            </span>
          </button>
        </div>
      </div>

      {/* ── LINKED DOCUMENT FLOW BANNER (IF CONNECTED CHAIN) ── */}
      {loadedOrderData?.documentChain && loadedOrderData.documentChain.length > 1 && (
        <div className="w-full bg-gradient-to-r from-indigo-900/90 via-purple-900/80 to-slate-900 text-white px-4 py-2 flex items-center justify-between gap-3 border-b border-indigo-700/50 shadow-sm text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold uppercase text-amber-300 flex items-center gap-1">
              <GitFork className="w-3.5 h-3.5" /> Linked Flow:
            </span>
            {loadedOrderData.documentChain.map((doc, dIdx) => (
              <span key={doc.id} className="flex items-center gap-1">
                {dIdx > 0 && <span className="text-slate-400 font-bold">→</span>}
                <button
                  type="button"
                  onClick={() => {
                    if (doc.id !== editOrderId) {
                      navigate(`/sales/order?id=${doc.id}`);
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                    doc.id === editOrderId
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-600'
                  }`}
                  title={`Open ${doc.docNo || doc.referenceNo} (${doc.type})`}
                >
                  {doc.docNo || doc.referenceNo} ({doc.type})
                </button>
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowDocFlowModal(true)}
            className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer transition-colors shrink-0"
          >
            <GitFork className="w-3 h-3" />
            <span>Document Flow Map</span>
          </button>
        </div>
      )}

      {/* ── ALERT BANNER: QUOTATION ALREADY CONVERTED TO ORDER (PERMANENTLY LOCKED) ── */}
      {orderMode === 'QUOTATION' && isConvertedQuote && (
        <div className="w-full bg-purple-950/95 border-b border-purple-700/80 px-4 py-2.5 flex items-center justify-between gap-3 text-purple-200 text-xs shadow-inner">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-extrabold text-white text-[11px] bg-purple-800 px-2 py-0.5 rounded border border-purple-600 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                QUOTATION LOCKED (IMMUTABLE)
              </span>
              <span>
                Converted to Sales Order <b className="font-mono text-amber-300">#{convertedChildOrder?.docNo || convertedChildOrder?.orderNumber || 'SO'}</b>. Converted quotations cannot be changed, edited, or deleted.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {convertedChildOrder && (
              <button
                type="button"
                onClick={() => navigate(`/sales/order?id=${convertedChildOrder.id}`)}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Open Sales Order #{convertedChildOrder.docNo || convertedChildOrder.orderNumber}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDocFlowModal(true)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-purple-500 text-purple-200 font-bold rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Document Flow</span>
            </button>
          </div>
        </div>
      )}

      {/* ── ALERT BANNER: SALES ORDER ALREADY INVOICED (PERMANENTLY LOCKED) ── */}
      {orderMode === 'STANDARD' && isInvoicedOrder && (
        <div className="w-full bg-emerald-950/95 border-b border-emerald-700/80 px-4 py-2.5 flex items-center justify-between gap-3 text-emerald-200 text-xs shadow-inner">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-extrabold text-white text-[11px] bg-emerald-800 px-2 py-0.5 rounded border border-emerald-600 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                SALES ORDER LOCKED (IMMUTABLE)
              </span>
              <span>
                Converted to Tax Invoice <b className="font-mono text-emerald-300">#{invoiceChildOrder?.docNo || invoiceChildOrder?.orderNumber || 'INV'}</b>. Converted sales orders cannot be changed, edited, or deleted. Only downstream Tax Invoices can be modified.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {invoiceChildOrder && (
              <button
                type="button"
                onClick={() => navigate(`/sales/order?id=${invoiceChildOrder.id}`)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Open Tax Invoice #{invoiceChildOrder.docNo || invoiceChildOrder.orderNumber}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDocFlowModal(true)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-emerald-500 text-emerald-200 font-bold rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Document Flow</span>
            </button>
          </div>
        </div>
      )}

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
              {!isDocumentLocked && (
                <>
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
                </>
              )}
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
                disabled={isDocumentLocked}
                placeholder="Search and Select Customer / Business Partner..."
                size="sm"
                className="h-[24px] text-[11.5px]"
              />
            </div>
          </div>

          {/* Customer GST Number & Tax Supply Type Determination */}
          <div className="flex items-center">
            <label className="w-32 text-[var(--sap-text-muted)] font-semibold text-[11.5px] shrink-0">
              Customer GSTIN
            </label>
            <div className="flex-1 max-w-[460px] flex items-center gap-1.5 flex-wrap">
              {taxRegNo ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded font-mono font-bold text-[11.5px] text-blue-700 dark:text-blue-300">
                  <span>{taxRegNo}</span>
                  {customerStateCode && (
                    <span className="font-sans font-medium text-[10.5px] text-slate-500 dark:text-slate-400">
                      • {getIndianStateName(customerStateCode)} ({customerStateCode})
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  Not Available (Unregistered)
                </span>
              )}
            </div>
          </div>

          {/* Tax Supply Type Rule (Auto-Applied & Locked if GST Available, Editable if Not Available) */}
          <div className="flex items-center">
            <label className="w-32 text-[var(--sap-text-muted)] font-semibold text-[11.5px] shrink-0">
              Tax Rule & Type
            </label>
            <div className="flex-1 max-w-[460px] flex items-center gap-2 flex-wrap">
              {hasCustomerGstin ? (
                /* GST Available: CANNOT BE CHANGED, AUTO APPLIED & LOCKED */
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded border shadow-xs ${
                    isInterState
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  }`}>
                    <span className="text-amber-500 font-black text-xs">🔒</span>
                    <span className="font-extrabold text-[11.5px]">
                      {isInterState ? '🌐 INTER-STATE (IGST)' : '🏛️ INTRA-STATE (CGST + SGST)'}
                    </span>
                    <span className="text-[10px] font-semibold opacity-90 pl-1.5 border-l border-current">
                      Auto-Applied (Cannot be changed)
                    </span>
                  </div>
                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                    (Supplier {supplierStateCode} {isInterState ? '≠' : '='} Customer {customerStateCode})
                  </span>
                </div>
              ) : (
                /* GST NOT Available: USER CAN MANUALLY CHANGE BETWEEN CGST+SGST AND IGST */
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded border border-slate-300 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => handleTaxSupplyTypeChange('INTRA_STATE')}
                      className={`px-2.5 py-0.5 text-[11px] font-bold rounded transition-all flex items-center gap-1 cursor-pointer ${
                        !isInterState
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Intra-State: CGST + SGST"
                    >
                      <span>🏛️ Intra-State</span>
                      <span className="text-[9.5px] opacity-90 font-normal">(CGST + SGST)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTaxSupplyTypeChange('INTER_STATE')}
                      className={`px-2.5 py-0.5 text-[11px] font-bold rounded transition-all flex items-center gap-1 cursor-pointer ${
                        isInterState
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Inter-State: IGST"
                    >
                      <span>🌐 Inter-State</span>
                      <span className="text-[9.5px] opacity-90 font-normal">(IGST)</span>
                    </button>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    isInterState
                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  }`}>
                    {isInterState ? 'IGST Selected' : 'CGST + SGST Selected'}
                  </span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    (Manual Selection Active)
                  </span>
                </div>
              )}
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
                className="min-w-[170px] w-44 h-[23px] px-2 text-[11.5px] font-mono font-bold border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] text-right outline-none"
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
                  : orderMode === 'INVOICE'
                  ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-300'
              }`}>
                {orderMode === 'STANDARD' ? 'Standard Order' : (orderMode === 'INVOICE' ? 'Tax Invoice' : 'Quotation')}
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

      {/* ENTERPRISE HIGH-CONTRAST TAB STRIP */}
      <div className="w-full bg-slate-100 dark:bg-slate-800/90 border-y border-slate-300 dark:border-slate-700 px-4 py-2 flex items-center justify-between gap-3 select-none overflow-x-auto shadow-xs shrink-0">
        <div className="flex items-center gap-2">
          {[
            {
              id: 'contents',
              label: 'Contents',
              icon: Layers,
              countBadge: `${lines.filter(l => l.productId || l.rawMaterialId).length} Items`,
              sub: 'Items & Grid',
              badgeColor: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700'
            },
            {
              id: 'logistics',
              label: 'Logistics',
              icon: Truck,
              countBadge: shippingMethod ? shippingMethod.split(' ')[0] : 'Road',
              sub: 'Dispatch & Fleet',
              badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700'
            },
            {
              id: 'accounting',
              label: 'Accounting & Payment',
              icon: CreditCard,
              countBadge: advancePaid >= financials.grandTotal && financials.grandTotal > 0
                ? 'PAID'
                : (advancePaid > 0 ? `₹${advancePaid.toFixed(0)} Paid` : (paymentTerms === 'PAID' ? 'PAID' : 'DUE')),
              sub: paymentTerms || 'Terms',
              badgeColor: advancePaid >= financials.grandTotal && financials.grandTotal > 0
                ? 'bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
                : (advancePaid > 0
                  ? 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700'
                  : 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700')
            },
            {
              id: 'tax',
              label: 'Tax & GST Studio',
              icon: Percent,
              countBadge: `₹${financials.totalTax.toFixed(2)}`,
              sub: isInterState ? 'IGST 100%' : 'CGST + SGST',
              badgeColor: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700'
            },
            {
              id: 'attachments',
              label: 'Attachments',
              icon: Paperclip,
              countBadge: `${attachments.length} files`,
              sub: `${attachments.length} files`,
              badgeColor: 'bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-700'
            }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative min-h-[44px] px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap border shadow-xs ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white border-amber-500 dark:border-amber-400 shadow-md ring-2 ring-amber-500/30'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white hover:border-slate-400'
                }`}
              >
                <div className={`p-1.5 rounded-md ${isActive ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-slate-200/80 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold tracking-tight">{tab.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${tab.badgeColor}`}>
                      {tab.countBadge}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {tab.sub}
                  </span>
                </div>
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[3px] bg-amber-500 dark:bg-amber-400 rounded-t-full shadow-xs" />
                )}
              </button>
            );
          })}
        </div>

        {/* Live Statutory Status Strip */}
        <div className="hidden xl:flex items-center gap-2 shrink-0">
          <div className="px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-500 dark:text-slate-400">Total:</span>
            <span className="font-mono font-extrabold text-slate-900 dark:text-white">
              ₹{financials.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('tax')}
            className={`px-3 py-1.5 rounded-md border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs ${
              activeTab === 'tax'
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                : 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 hover:bg-blue-100'
            }`}
            title="Open GST & Statutory Tax Tab"
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Tax: ₹{financials.totalTax.toFixed(2)}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('accounting')}
            className={`px-3 py-1.5 rounded-md border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs ${
              activeTab === 'accounting'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                : (advancePaid >= financials.grandTotal && financials.grandTotal > 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                  : 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100')
            }`}
            title="Open Accounting & Payments Tab"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Due: ₹{financials.balanceDue.toFixed(2)}</span>
          </button>
        </div>
      </div>

      {/* FULL SCREEN TAB BODY */}
      <div className="w-full p-4 bg-[var(--sap-bg-window)] flex-1 flex flex-col">
        
        {/* TAB 1: CONTENTS (Table Grid with In-Grid Search & Select) */}
        {activeTab === 'contents' && (
          <div className="w-full flex-1 flex flex-col space-y-2">
            
            {/* Grid Controls Bar */}
            <div className="flex items-center justify-between text-[11.5px] pb-1">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[var(--sap-text)] flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-amber-500" />
                  <span>Document Rows:</span>
                  <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                    ({lines.filter(l => l.productId || l.rawMaterialId).length} filled / {lines.length} total)
                  </span>
                  <span className="ml-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-[11px] flex items-center gap-1 shadow-xs">
                    <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80 uppercase font-medium">Total Qty:</span>
                    <span className="font-extrabold">{totalDocumentQuantity.toLocaleString()}</span>
                    <span className="text-[10px] opacity-75">units</span>
                  </span>
                </span>
                {lastStockSyncTime && (
                  <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Live Stock Synced</span>
                  </span>
                )}
              </div>

              {!isDocumentLocked ? (
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
              ) : (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xs text-[11px] font-bold text-amber-700 dark:text-amber-400">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Document Locked: Item rows cannot be added, edited, or cleared</span>
                </div>
              )}
            </div>

            {/* STOCK FEASIBILITY & COMMERCIAL ORDER STATUS BANNER */}
            {activeLines.length > 0 && (
              <div className="w-full mb-2">
                {/* CONVERTED FROM SOURCE ORDER BANNER */}
                {sourceDocNo && orderMode === 'INVOICE' && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/60 dark:to-indigo-950/60 border border-blue-400 dark:border-blue-700 rounded-md p-2.5 flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                        INV
                      </div>
                      <div>
                        <div className="font-bold text-xs text-blue-950 dark:text-blue-100 flex items-center gap-2">
                          <span>Converting Standard Order #{sourceDocNo} → Tax Invoice</span>
                          <span className="text-[10px] font-mono bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200 px-1.5 py-0.2 rounded font-bold">
                            Order Conversion
                          </span>
                        </div>
                        <div className="text-[11px] text-blue-800 dark:text-blue-300">
                          Reserved inventory from order #{sourceDocNo} is allocated to this invoice. Posting will deduct physical stock and mark order as invoiced.
                        </div>
                      </div>
                    </div>
                    {sourceOrderId && (
                      <button
                        type="button"
                        onClick={() => navigate(`/sales/order?id=${sourceOrderId}`)}
                        className="px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded shadow-xs hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                      >
                        View Source Order #{sourceDocNo}
                      </button>
                    )}
                  </div>
                )}

                {/* QUOTATION MODE */}
                {orderMode === 'QUOTATION' && (
                  <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 rounded-md p-2.5 flex items-center justify-between text-purple-900 dark:text-purple-200">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                      <span className="font-bold text-xs">
                        🟣 Commercial Quotation Mode: Non-binding price quote. Zero warehouse stock effect (neither reserved nor deducted).
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded text-purple-800 dark:text-purple-300">
                      Quotation (No Stock Effect)
                    </span>
                  </div>
                )}

                {/* STANDARD ORDER WITH SHORTAGES (BACK-ORDER ALLOWED) */}
                {orderMode === 'STANDARD' && stockDeficitSummary.hasShortages && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-md p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <div className="font-bold text-xs flex items-center gap-1.5 flex-wrap">
                          <span>⚠️ Shortage on {stockDeficitSummary.shortageLines.length} item(s) — Back-Order Allowed</span>
                          <span className="bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 px-1.5 py-0.2 rounded font-mono text-[10px] font-bold">
                            Shortfall: -{stockDeficitSummary.totalDeficitQty} units
                          </span>
                          <span className="bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.2 rounded font-mono text-[10px]">
                            Stock Reserved: {stockDeficitSummary.totalStockAllocated} units
                          </span>
                        </div>
                        <div className="text-[11px] text-amber-800 dark:text-amber-300">
                          Order can be saved immediately! Shortfall will automatically appear in the <strong>Production Requirement List</strong> for batch scheduling.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/production/requirements')}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-md shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>View Production Requirements →</span>
                    </button>
                  </div>
                )}

                {/* STANDARD ORDER 100% IN-STOCK */}
                {orderMode === 'STANDARD' && !stockDeficitSummary.hasShortages && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-md p-2.5 flex items-center justify-between text-emerald-900 dark:text-emerald-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          <span>✓ 100% In-Stock Reserved: All {activeLines.length} line items have sufficient free warehouse stock.</span>
                        </div>
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                          Saving this order reserves stock. Once saved, it is <strong>Ready to Invoice</strong>.
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-300">
                      Ready to Invoice
                    </span>
                  </div>
                )}

                {/* INVOICE MODE WITH SHORTAGE (BLOCKED) */}
                {orderMode === 'INVOICE' && stockDeficitSummary.hasShortages && (
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-md p-2.5 flex items-center justify-between gap-3 text-rose-900 dark:text-rose-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                      <div>
                        <div className="font-bold text-xs flex items-center gap-1.5 flex-wrap">
                          <span>⛔ Invoice Blocked: Stock Deficit in {stockDeficitSummary.shortageLines.length} item(s)</span>
                          <span className="bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 px-1.5 py-0.2 rounded font-mono text-[10px] font-bold">
                            Short: -{stockDeficitSummary.totalDeficitQty} units
                          </span>
                        </div>
                        <div className="text-[11px] text-rose-700 dark:text-rose-300">
                          Tax Invoices strictly reduce warehouse stock and cannot post with negative inventory. Switch to <strong>Standard Order</strong> to place a back-order, or produce stock first.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOrderMode('STANDARD');
                        setStatusMessage({
                          type: 'ready',
                          text: 'Switched to Standard Order mode. You can commit the order and queue production.'
                        });
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-md shadow-xs shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Switch to Standard Order</span>
                    </button>
                  </div>
                )}

                {/* INVOICE MODE 100% IN-STOCK */}
                {orderMode === 'INVOICE' && !stockDeficitSummary.hasShortages && (
                  <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 rounded-md p-2.5 flex items-center justify-between gap-3 text-blue-900 dark:text-blue-200">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                      <div>
                        <div className="font-bold text-xs flex items-center gap-2">
                          <span>Tax Invoice Mode: Atomic Stock Deduction at Posting</span>
                          <span className="bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200 px-1.5 py-0.2 rounded font-mono text-[10px] font-bold">
                            Stock Reduces on Save
                          </span>
                        </div>
                        <div className="text-[11px] text-blue-800 dark:text-blue-300">
                          All items verified in-stock. Posting this invoice assigns consecutive GST series <strong>INV</strong> and updates the stock ledger.
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded text-blue-800 dark:text-blue-300">
                      Ready to Post
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* DOCUMENT ROWS EXCEL-STYLE RESIZABLE GRID */}
            <div className="w-full flex flex-col">
              {/* Compact Excel Toolbar */}
              <div className="w-full flex items-center justify-between px-2.5 py-1 text-xs bg-[var(--sap-header-bg)] border border-b-0 border-[var(--sap-border-inner)] rounded-t-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[var(--sap-text)] flex items-center gap-1.5 text-[11.5px]">
                    <Table className="w-3.5 h-3.5 text-amber-600" />
                    <span>Document Rows</span>
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-white/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-[var(--sap-border-inner)]">
                    {computedLines.filter(l => l.productId || l.rawMaterialId || l.itemDescription).length} items
                  </span>
                  <span className="text-[10px] text-[var(--sap-text-muted)] hidden md:inline-flex items-center gap-1.5 ml-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Excel Column Resizer: Drag column borders to resize • Double-click border to reset</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetColWidths}
                    className="px-2 py-0.5 rounded text-[10.5px] font-semibold text-[var(--sap-text)] hover:text-amber-700 dark:hover:text-amber-300 hover:bg-white/60 dark:hover:bg-slate-700/60 border border-transparent hover:border-[var(--sap-border-inner)] transition-all flex items-center gap-1 cursor-pointer"
                    title="Reset all column widths to default sizes"
                  >
                    <RefreshCw className="w-3 h-3 text-slate-500" />
                    <span>Reset Column Widths</span>
                  </button>
                </div>
              </div>

              {/* FULL SCREEN DOCUMENT LINE TABLE GRID WITH LIVE STOCK */}
              <div className="w-full flex-1 border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] overflow-x-auto max-h-[500px] shadow-sm relative">
                <table
                  style={{ tableLayout: 'fixed', width: '100%', minWidth: `${totalTableWidth}px` }}
                  className="w-full border-collapse text-[11.5px] select-text"
                >
                  <colgroup>
                    <col style={{ width: `${colWidths.rowNo}px` }} />
                    <col style={{ width: `${colWidths.itemType}px` }} />
                    <col style={{ width: `${colWidths.systemCode}px` }} />
                    <col style={{ width: `${colWidths.productName}px` }} />
                    <col style={{ width: `${colWidths.category}px` }} />
                    <col style={{ width: `${colWidths.subcategory}px` }} />
                    <col style={{ width: `${colWidths.uom}px` }} />
                    <col style={{ width: `${colWidths.packing}px` }} />
                    <col style={{ width: `${colWidths.quantity}px` }} />
                    <col style={{ width: `${colWidths.salePrice}px` }} />
                    <col style={{ width: `${colWidths.discount}px` }} />
                    <col style={{ width: `${colWidths.taxCode}px` }} />
                    <col style={{ width: `${colWidths.total}px` }} />
                    <col style={{ width: `${colWidths.inStock}px` }} />
                    <col style={{ width: `${colWidths.remainingStock}px` }} />
                    <col style={{ width: `${colWidths.reserved}px` }} />
                    <col style={{ width: `${colWidths.stockCheck}px` }} />
                    <col style={{ width: `${colWidths.actions}px` }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-[var(--sap-header-bg)] text-[var(--sap-text)] border-b border-[var(--sap-border-inner)] sticky top-0 z-10 font-bold select-none text-[11px] h-[30px]">
                      {renderTh('rowNo', '#', 'center')}
                      {renderTh('itemType', 'Item Type', 'center')}
                      {renderTh('systemCode', 'System Code *', 'left')}
                      {renderTh('productName', 'Product / Item Name *', 'left')}
                      {renderTh('category', 'Category *', 'left')}
                      {renderTh('subcategory', 'Base / Subcategory', 'left')}
                      {renderTh('uom', 'Unit of Sale *', 'center')}
                      {renderTh('packing', 'Packing?', 'center')}
                      {renderTh('quantity', 'Quantity', 'right')}
                      {renderTh('salePrice', 'Sale Price (INR) *', 'right')}
                      {renderTh('discount', 'Discount %', 'right')}
                      {renderTh('taxCode', 'Tax Code', 'left')}
                      {renderTh('total', 'Total (LC)', 'right')}
                      {renderTh('inStock', 'In Stock', 'right')}
                      {renderTh('remainingStock', 'Remaining Stock', 'right', 'Remaining stock after deducting entered quantity')}
                      {renderTh('reserved', 'Reserved', 'right')}
                      {renderTh('stockCheck', orderMode === 'INVOICE' ? 'Stock Check' : 'Stock Check / Shortfall', 'center')}
                      {renderTh('actions', '✕', 'center')}
                    </tr>
                  </thead>
                <tbody>
                  {computedLines.map((line, idx) => (
                    <tr
                      key={line.id}
                      className={`h-[26px] border-b border-[var(--sap-border-inner)] transition-colors ${
                        line.productId && !line.isSufficient && orderMode === 'INVOICE'
                          ? 'bg-rose-50/80 dark:bg-rose-950/40'
                          : line.productId && line.shortfallQty > 0 && orderMode === 'STANDARD'
                          ? 'bg-amber-50/70 dark:bg-amber-950/40'
                          : idx % 2 === 1 ? 'bg-[var(--sap-grid-alt)]' : 'bg-[var(--sap-input-bg)]'
                      } hover:bg-amber-50/40 dark:hover:bg-blue-950/20`}
                    >
                      {/* Row # */}
                      <td className="border-r border-[var(--sap-border-inner)] text-center text-[var(--sap-text-muted)] font-mono text-[11px]">
                        {line.rowNo}
                      </td>

                      {/* Item Type (Product or Raw Material) */}
                      <td className="border-r border-[var(--sap-border-inner)] p-0 text-center">
                        <div className="flex items-center justify-center h-full px-1">
                          <select
                            value={line.rawMaterialId || line.itemType === 'RAW_MATERIAL' ? 'RAW_MATERIAL' : 'PRODUCT'}
                            disabled={isDocumentLocked}
                            onChange={(e) => handleLineTypeChange(line.id, e.target.value)}
                            className={`w-full py-0.5 px-1 text-[10.5px] font-bold rounded-xs border transition-colors outline-none cursor-pointer ${
                              line.rawMaterialId || line.itemType === 'RAW_MATERIAL'
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:border-blue-500'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:border-amber-500'
                            } ${isDocumentLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                            title="Select item type: Finished Product or Raw Material"
                          >
                            <option value="PRODUCT">Product</option>
                            <option value="RAW_MATERIAL">Raw Material</option>
                          </select>
                        </div>
                      </td>

                      {/* System Code with Fixed Search and Orange Drill-down */}
                      <td className="border-r border-[var(--sap-border-inner)] p-0 overflow-hidden">
                        <div className="flex items-center h-full w-full px-1 min-w-0 gap-0.5">
                          <input
                            type="text"
                            value={line.systemCode}
                            placeholder={line.rawMaterialId || line.itemType === 'RAW_MATERIAL' ? "RM-00..." : "BFD101..."}
                            readOnly={isDocumentLocked}
                            onChange={(e) => {
                              if (!isDocumentLocked) {
                                handleLineChange(line.id, 'systemCode', e.target.value);
                                handleOpenGridSearch(line.id, e.target, e.target.value);
                              }
                            }}
                            onClick={(e) => { if (!isDocumentLocked) handleOpenGridSearch(line.id, e.target, line.systemCode || ''); }}
                            onFocus={(e) => { if (!isDocumentLocked) handleOpenGridSearch(line.id, e.target, line.systemCode || ''); }}
                            className={`flex-1 min-w-0 h-full bg-transparent border-0 outline-none font-mono font-bold text-[11px] text-[var(--sap-text)] placeholder:text-slate-400 placeholder:font-normal truncate ${isDocumentLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                          />
                          <div className="flex items-center gap-0.5 shrink-0">
                            {!isDocumentLocked && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenGridSearch(line.id, e.currentTarget.parentElement, line.systemCode || '');
                                }}
                                className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded cursor-pointer transition-colors shrink-0"
                                title="Search Code in catalog"
                              >
                                <Search className="w-3 h-3" />
                              </button>
                            )}
                            {line.productId && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStockQueryProductId(line.productId);
                                  setIsStockQueryOpen(true);
                                }}
                                className="w-3.5 h-full text-[var(--sap-drilldown)] font-extrabold text-[11px] flex items-center justify-center shrink-0 hover:scale-125 cursor-pointer"
                                title="Drill-down into live batches"
                              >
                                ➔
                              </button>
                            )}
                            {line.rawMaterialId && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenRMLotModal(line);
                                }}
                                className="w-3.5 h-full text-blue-600 font-extrabold text-[11px] flex items-center justify-center shrink-0 hover:scale-125 cursor-pointer"
                                title="Drill-down into RM Batches / FEFO lots"
                              >
                                ➔
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Product Name * with Fixed Docked Search Icon */}
                      <td className="border-r border-[var(--sap-border-inner)] p-0 overflow-hidden">
                        <div className="flex items-center h-full w-full px-1 min-w-0 gap-1">
                          <input
                            type="text"
                            value={line.itemDescription}
                            placeholder={line.rawMaterialId || line.itemType === 'RAW_MATERIAL' ? "Raw Material Name..." : "Product Name..."}
                            readOnly={isDocumentLocked}
                            onChange={(e) => {
                              if (!isDocumentLocked) {
                                handleLineChange(line.id, 'itemDescription', e.target.value);
                                handleOpenGridSearch(line.id, e.target, e.target.value);
                              }
                            }}
                            onClick={(e) => { if (!isDocumentLocked) handleOpenGridSearch(line.id, e.target, line.itemDescription || ''); }}
                            onFocus={(e) => { if (!isDocumentLocked) handleOpenGridSearch(line.id, e.target, line.itemDescription || ''); }}
                            className={`flex-1 min-w-0 h-full bg-transparent border-0 outline-none font-semibold text-[11.5px] text-[var(--sap-text)] placeholder:text-slate-400 placeholder:font-normal truncate ${isDocumentLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                          />
                          {!isDocumentLocked && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenGridSearch(line.id, e.currentTarget.parentElement, line.itemDescription || '');
                              }}
                              className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded cursor-pointer transition-colors shrink-0"
                              title="Search item by name in catalog"
                            >
                              <Search className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Category * */}
                      <td className="border-r border-[var(--sap-border-inner)] px-1 text-[11px] text-[var(--sap-text-muted)] truncate">
                        {line.category || '-'}
                      </td>

                      {/* Base / Subcategory */}
                      <td className="border-r border-[var(--sap-border-inner)] px-1 text-[10.5px] text-[var(--sap-text-muted)] truncate">
                        {line.baseCategory ? `${line.baseCategory}${line.subcategory && line.subcategory !== '-' ? ` • ${line.subcategory}` : ''}` : '-'}
                      </td>

                      {/* Unit of Sale * */}
                      <td className="border-r border-[var(--sap-border-inner)] text-center text-[11px] font-semibold text-[var(--sap-text)] px-0.5">
                        {line.unitOfSale || (line.rawMaterialId ? 'kg' : 'pcs')}
                      </td>

                      {/* Packing? Checkbox */}
                      <td className="border-r border-[var(--sap-border-inner)] text-center p-0">
                        <div className="flex items-center justify-center h-full">
                          <input
                            type="checkbox"
                            checked={Boolean(line.isPackingCharge)}
                            disabled={isDocumentLocked}
                            onChange={(e) => handleLineChange(line.id, 'isPackingCharge', e.target.checked)}
                            className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 dark:border-slate-700 cursor-pointer"
                            title="Check to mark line as Packing Charge (e.g. Thermocol Box, Dry Ice)"
                          />
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="border-r border-[var(--sap-border-inner)] p-0">
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          readOnly={isDocumentLocked}
                          onChange={(e) => handleLineChange(line.id, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className={`w-full h-full px-1 bg-transparent border-0 outline-none text-right font-mono font-bold text-[11.5px] text-[var(--sap-text)] ${isDocumentLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                        />
                      </td>

                      {/* Sale Price (INR) * */}
                      <td className="border-r border-[var(--sap-border-inner)] p-0">
                        <input
                          type="number"
                          step="0.01"
                          value={line.unitPrice}
                          readOnly={isDocumentLocked}
                          onChange={(e) => handleLineChange(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className={`w-full h-full px-1 bg-transparent border-0 outline-none text-right font-mono font-semibold text-[11.5px] text-[var(--sap-text)] ${isDocumentLocked ? 'cursor-not-allowed opacity-80' : ''}`}
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
                          readOnly={isDocumentLocked}
                          onChange={(e) => handleLineChange(line.id, 'discountPercent', parseFloat(e.target.value) || 0)}
                          className={`w-full h-full px-1 bg-transparent border-0 outline-none text-right font-mono text-[11.5px] text-[var(--sap-text)] ${isDocumentLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                        />
                      </td>

                      {/* Tax Code */}
                      <td className="border-r border-[var(--sap-border-inner)] p-0">
                        <select
                          value={line.taxCode}
                          disabled={isDocumentLocked}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleLineChange(line.id, 'taxCode', val);
                            if (line.isPackingCharge) {
                              setPackingTaxCode(val);
                            }
                          }}
                          className={`w-full h-full px-1 bg-transparent border-0 outline-none text-[11px] font-medium text-[var(--sap-text)] ${isDocumentLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                        >
                          {!isInterState ? (
                            <>
                              <option value="EXEMPT">EXEMPT (0%)</option>
                              <option value="SCG5">SCG5 (5% - CGST 2.5% + SGST 2.5%)</option>
                              <option value="SCG9">SCG9 (9% - CGST 4.5% + SGST 4.5%)</option>
                              <option value="SCG12">SCG12 (12% - CGST 6% + SGST 6%)</option>
                              <option value="SCG18">SCG18 (18% - CGST 9% + SGST 9%)</option>
                              <option value="SCG28">SCG28 (28% - CGST 14% + SGST 14%)</option>
                            </>
                          ) : (
                            <>
                              <option value="EXEMPT">EXEMPT (0%)</option>
                              <option value="IGST5">IGST5 (5% - Integrated GST)</option>
                              <option value="IGST9">IGST9 (9% - Integrated GST)</option>
                              <option value="IGST12">IGST12 (12% - Integrated GST)</option>
                              <option value="IGST18">IGST18 (18% - Integrated GST)</option>
                              <option value="IGST28">IGST28 (28% - Integrated GST)</option>
                            </>
                          )}
                        </select>
                      </td>

                      {/* Total (LC) */}
                      <td className="border-r border-[var(--sap-border-inner)] px-1 text-right font-mono font-bold text-[11.5px] text-[var(--sap-text)] bg-[var(--sap-input-readonly)]">
                        {line.lineTotal ? `${line.lineTotal.toFixed(2)} INR` : '0.00 INR'}
                      </td>

                      {/* In Stock (formerly On-Hand) */}
                      <td className="border-r border-[var(--sap-border-inner)] px-1 text-right font-mono text-[11px] font-bold text-[var(--sap-text)] bg-[var(--sap-input-readonly)]">
                        {(line.productId || line.rawMaterialId) ? line.inStock : '-'}
                      </td>

                      {/* Remaining Stock (In Stock minus entered Quantity) */}
                      <td className="border-r border-[var(--sap-border-inner)] px-1 text-right font-mono text-[11px] bg-[var(--sap-input-readonly)]">
                        {(line.productId || line.rawMaterialId) ? (
                          <span className={`font-bold ${line.remainingStock === 0 && line.quantity > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>
                            {line.remainingStock}
                          </span>
                        ) : '-'}
                      </td>

                      {/* Reserved */}
                      <td className="border-r border-[var(--sap-border-inner)] px-1 text-right font-mono font-semibold text-[11px] text-emerald-700 dark:text-emerald-400 bg-[var(--sap-input-readonly)]">
                        {line.productId ? (orderMode === 'QUOTATION' ? 0 : line.reservedQty) : (line.rawMaterialId ? 0 : '-')}
                      </td>

                      {/* Shortfall or Stock Check */}
                      <td className="border-r border-[var(--sap-border-inner)] text-center px-1 text-[10.5px]">
                        {line.rawMaterialId || line.itemType === 'RAW_MATERIAL' ? (
                          <div className="flex items-center justify-center gap-1">
                            {(() => {
                              const totalAllocated = (line.batchAllocations || []).reduce((s, b) => s + Number(b.allocatedQty || b.quantity || 0), 0);
                              const reqQty = Number(line.quantity) || 0;
                              const isFullyAllocated = totalAllocated >= reqQty && reqQty > 0;
                              const isPartial = totalAllocated > 0 && totalAllocated < reqQty;

                              return (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRMLotModal(line)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs ${
                                    isFullyAllocated
                                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                      : isPartial
                                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
                                      : 'bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300'
                                  }`}
                                  title="Batch / Lot FEFO allocation for Raw Material"
                                >
                                  <Boxes className="w-3.5 h-3.5" />
                                  <span>
                                    {isFullyAllocated
                                      ? `${totalAllocated} Allocated`
                                      : isPartial
                                      ? `${totalAllocated}/${reqQty} Allocated`
                                      : `Allocate (${reqQty})`}
                                  </span>
                                </button>
                              );
                            })()}
                          </div>
                        ) : line.productId ? (
                          orderMode === 'INVOICE' ? (
                            line.isSufficient ? (
                              <span className="px-2 py-0.5 rounded-xs font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span>🟢 Available</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-xs font-mono font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700 inline-flex items-center gap-1">
                                <span>🔴 Short -{line.deficit}</span>
                              </span>
                            )
                          ) : orderMode === 'STANDARD' ? (
                            line.shortfallQty > 0 ? (
                              <span className="px-2 py-0.5 rounded-xs font-mono font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700 inline-flex items-center gap-1" title="Back-order requirement queued for production">
                                <span>⚠️ -{line.shortfallQty}</span>
                              </span>
                            ) : (
                              <span className="text-emerald-700 dark:text-emerald-400 font-mono font-bold text-[11px]">
                                0 (Covered)
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">-</span>
                          )
                        ) : (
                          <span className="text-slate-400 font-mono">-</span>
                        )}
                      </td>

                      {/* Delete Row */}
                      <td className="text-center p-0">
                        <button
                          type="button"
                          disabled={isDocumentLocked}
                          onClick={() => handleRemoveLine(line.id)}
                          className={`w-full h-full font-bold flex items-center justify-center ${
                            isDocumentLocked
                              ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                              : 'text-slate-400 hover:text-red-600 cursor-pointer'
                          }`}
                          title={isDocumentLocked ? "Document is locked and cannot be edited" : "Delete Line"}
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
                        Select Item for Row #{lines.find(l => l.id === activeGridSearchLineId)?.rowNo || 1}
                      </span>
                      <div className="flex items-center bg-slate-900 rounded p-0.5 ml-2 border border-slate-700">
                        <button
                          type="button"
                          onClick={() => setGridSearchScope('PRODUCTS')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                            gridSearchScope === 'PRODUCTS'
                              ? 'bg-amber-500 text-slate-950'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          Finished Products ({gridFilteredProducts.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setGridSearchScope('RAW_MATERIALS')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                            gridSearchScope === 'RAW_MATERIALS'
                              ? 'bg-amber-500 text-slate-950'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          Raw Materials / Resale ({gridFilteredRawMaterials.length})
                        </button>
                      </div>
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (gridSearchScope === 'PRODUCTS' && gridFilteredProducts.length > 0) {
                              e.preventDefault();
                              handleSelectProductForLine(activeGridSearchLineId, gridFilteredProducts[0]);
                              setActiveGridSearchLineId(null);
                            } else if (gridSearchScope === 'RAW_MATERIALS' && gridFilteredRawMaterials.length > 0) {
                              e.preventDefault();
                              handleSelectRawMaterialForLine(activeGridSearchLineId, gridFilteredRawMaterials[0], false);
                              setActiveGridSearchLineId(null);
                            }
                          }
                        }}
                        placeholder={gridSearchScope === 'PRODUCTS'
                          ? "Search System Code, Product Name, Category, Subcategory (e.g. K123, kulfistick, kulfi almond)..."
                          : "Search Raw Material Code, Name, Category (e.g. RM-00008, Box, Ice, Flavor)..."}
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

                  {/* PRODUCTS SCOPE */}
                  {gridSearchScope === 'PRODUCTS' && (
                    <>
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
                            <div>No product found matching "{gridSearchQuery}" {gridSelectedBaseCategory !== 'All' ? `in ${gridSelectedBaseCategory}` : ''}</div>
                            {gridSelectedBaseCategory !== 'All' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setGridSelectedBaseCategory('All');
                                  setGridSelectedSubcategory('All');
                                }}
                                className="mt-2.5 px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-xs text-xs hover:bg-amber-400 cursor-pointer shadow-xs inline-flex items-center gap-1"
                              >
                                <span>Search in All Categories</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* RAW MATERIALS SCOPE */}
                  {gridSearchScope === 'RAW_MATERIALS' && (
                    <div className="flex-1 overflow-y-auto max-h-[290px] divide-y divide-slate-100 dark:divide-slate-800">
                      <div className="grid grid-cols-12 gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                        <div className="col-span-2">RM Code</div>
                        <div className="col-span-4">Raw Material Name</div>
                        <div className="col-span-2">Category</div>
                        <div className="col-span-1 text-center">UOM</div>
                        <div className="col-span-1 text-right">Unit Rate</div>
                        <div className="col-span-1 text-center">Stock</div>
                        <div className="col-span-1 text-center">Action</div>
                      </div>

                      {gridFilteredRawMaterials.map(rm => {
                        const price = Number(rm.ratePerUnit || 0);
                        const liveStock = Number(rm.currentStock || 0);
                        return (
                          <div
                            key={rm.id}
                            onClick={() => {
                              handleSelectRawMaterialForLine(activeGridSearchLineId, rm, false);
                              setActiveGridSearchLineId(null);
                            }}
                            className="grid grid-cols-12 gap-1.5 px-3 py-1.5 hover:bg-amber-50 dark:hover:bg-slate-800 cursor-pointer items-center transition-colors group text-[11px]"
                          >
                            <div className="col-span-2 font-mono font-bold text-amber-700 dark:text-amber-400 truncate">
                              {rm.code}
                            </div>
                            <div className="col-span-4 font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors truncate">
                              {rm.printName || rm.name}
                            </div>
                            <div className="col-span-2 text-slate-600 dark:text-slate-300 font-medium truncate text-[10.5px]">
                              {rm.category?.name || rm.category || 'Raw Material'}
                            </div>
                            <div className="col-span-1 text-center text-slate-700 dark:text-slate-300 font-medium">
                              {rm.unitId || 'kg'}
                            </div>
                            <div className="col-span-1 text-right font-bold text-slate-900 dark:text-white">
                              ₹{price.toFixed(2)}
                            </div>
                            <div className="col-span-1 text-center">
                              <span className={`px-1.5 py-0.2 rounded-xs font-mono font-bold text-[9.5px] inline-flex items-center gap-1 ${
                                liveStock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                <span className={`w-1 h-1 rounded-full ${liveStock > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                {liveStock}
                              </span>
                            </div>
                            <div className="col-span-1 text-center flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectRawMaterialForLine(activeGridSearchLineId, rm, true);
                                  setActiveGridSearchLineId(null);
                                }}
                                className="px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 text-[9px] font-bold rounded cursor-pointer"
                                title="Add as Packing Line"
                              >
                                📦 Pack
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {gridFilteredRawMaterials.length === 0 && (
                        <div className="p-6 text-center text-slate-400">
                          <div>No raw material found matching "{gridSearchQuery}"</div>
                        </div>
                      )}
                    </div>
                  )}

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

        {/* TAB 3: ACCOUNTING & FINANCIAL MANAGEMENT */}
        {activeTab === 'accounting' && (
          <div className="w-full space-y-4">
            
            {/* Top Financial KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Grand Total Card */}
              <div className="p-3.5 rounded-lg bg-gradient-to-br from-blue-500/10 via-slate-50 to-white dark:from-blue-950/30 dark:via-slate-850 dark:to-slate-900 border border-blue-200 dark:border-blue-900/60 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Grand Document Total</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                    INR (₹)
                  </span>
                </div>
                <div className="text-xl font-mono font-black text-slate-900 dark:text-white">
                  ₹{financials.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  Taxable: ₹{financials.taxableSubtotal.toFixed(2)} + Tax: ₹{financials.totalTax.toFixed(2)}
                </div>
              </div>

              {/* Advance Paid Card */}
              <div className="p-3.5 rounded-lg bg-gradient-to-br from-emerald-500/10 via-slate-50 to-white dark:from-emerald-950/30 dark:via-slate-850 dark:to-slate-900 border border-emerald-200 dark:border-emerald-900/60 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Advance / Settled</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    {financials.grandTotal > 0 ? `${Math.min(100, Math.round(((Number(advancePaid) || 0) / financials.grandTotal) * 100))}%` : '0%'}
                  </span>
                </div>
                <div className="text-xl font-mono font-black text-emerald-700 dark:text-emerald-400">
                  ₹{(Number(advancePaid) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${financials.grandTotal > 0 ? Math.min(100, Math.round(((Number(advancePaid) || 0) / financials.grandTotal) * 100)) : 0}%` }}
                  />
                </div>
              </div>

              {/* Balance Due Card */}
              <div className={`p-3.5 rounded-lg bg-gradient-to-br shadow-xs flex flex-col justify-between border ${
                financials.balanceDue > 0
                  ? 'from-rose-500/10 via-slate-50 to-white dark:from-rose-950/30 dark:via-slate-850 dark:to-slate-900 border-rose-200 dark:border-rose-900/60'
                  : 'from-emerald-500/10 via-slate-50 to-white dark:from-emerald-950/30 dark:via-slate-850 dark:to-slate-900 border-emerald-200 dark:border-emerald-900/60'
              }`}>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  <span className="flex items-center gap-1.5">
                    <Clock className={`w-4 h-4 ${financials.balanceDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
                    <span>Balance Due</span>
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    financials.balanceDue > 0
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}>
                    {financials.balanceDue > 0 ? 'OUTSTANDING' : 'CLEAR'}
                  </span>
                </div>
                <div className={`text-xl font-mono font-black ${
                  financials.balanceDue > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                }`}>
                  ₹{financials.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {financials.balanceDue > 0 ? 'To be collected per payment terms' : 'Full payment accounted'}
                </div>
              </div>

              {/* Settlement Status Card */}
              <div className="p-3.5 rounded-lg bg-gradient-to-br from-amber-500/10 via-slate-50 to-white dark:from-amber-950/30 dark:via-slate-850 dark:to-slate-900 border border-amber-200 dark:border-amber-900/60 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Settlement Mode</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    {paymentTerms}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                  {paymentMethod}
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  Account: Trade Debtors Control
                </div>
              </div>
            </div>

            {/* Main Accounting Two-Column Studio */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
              
              {/* Left Column (Cols 7): Payment Terms & Dynamic Mode Studio */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* Payment Terms & Advance Configuration */}
                <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                      <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Payment Terms & Settlement Structure</span>
                    </div>
                    <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                      Standard Credit Protocol
                    </span>
                  </div>

                  {/* Payment Terms Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1 text-[11px]">
                        Payment Terms
                      </label>
                      <select
                        value={paymentTerms}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPaymentTerms(val);
                          if (val === 'PAID') {
                            setAdvancePaid(financials.grandTotal);
                          }
                        }}
                        className="w-full h-9 px-3 text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="PAID">PAID (Full Settlement)</option>
                        <option value="Immediate Cash">Immediate Cash (Cash Sale)</option>
                        <option value="Net 15">Net 15 Days (Credit)</option>
                        <option value="Net 30">Net 30 Days (Credit)</option>
                        <option value="Net 45">Net 45 Days (Credit)</option>
                        <option value="Net 60">Net 60 Days (Credit)</option>
                        <option value="Advance Received">Advance Received (Partial)</option>
                        <option value="Not Paid">Not Paid (Due upon receipt)</option>
                      </select>
                    </div>

                    {/* Advance Paid Input with Quick Buttons */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-slate-600 dark:text-slate-300 font-semibold text-[11px]">
                          Advance Received (₹)
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAdvancePaid(financials.grandTotal);
                              setPaymentTerms('PAID');
                            }}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 cursor-pointer transition-colors"
                          >
                            100% Full
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAdvancePaid(round2(financials.grandTotal / 2));
                              setPaymentTerms('Advance Received');
                            }}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-950 dark:text-blue-300 cursor-pointer transition-colors"
                          >
                            50%
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAdvancePaid(0);
                              setPaymentTerms('Not Paid');
                            }}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-2 font-mono font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={advancePaid}
                          onChange={(e) => setAdvancePaid(parseFloat(e.target.value) || 0)}
                          className="w-full h-9 pl-7 pr-3 text-right font-mono font-black text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Payment Mode Tiles */}
                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-2 text-[11px]">
                      Select Payment Mode / Settlement Channel
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { id: 'Bank Transfer / NEFT', label: 'Bank / NEFT', icon: Landmark },
                        { id: 'Cash', label: 'Cash Counter', icon: Banknote },
                        { id: 'UPI / QR', label: 'UPI / QR', icon: Sparkles },
                        { id: 'Credit / Debit Card', label: 'Card / POS', icon: CreditCard },
                        { id: 'Cheque', label: 'Cheque', icon: FileText }
                      ].map(mode => {
                        const ModeIcon = mode.icon;
                        const isSelected = paymentMethod === mode.id;
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setPaymentMethod(mode.id)}
                            className={`p-2.5 rounded-lg border font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20 shadow-xs'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-750'
                            }`}
                          >
                            <ModeIcon className={`w-4 h-4 ${isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
                            <span className="text-[11px] text-center leading-tight">{mode.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Dynamic Mode-Specific Settlement Panel */}
                <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                  {/* Mode: Bank Transfer */}
                  {paymentMethod.includes('Bank') && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-blue-200 dark:border-blue-900/60 pb-2">
                        <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5 text-xs">
                          <Landmark className="w-4 h-4 text-blue-600" />
                          <span>Bank Remittance & NEFT / RTGS Transfer Details</span>
                        </span>
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-100 dark:bg-blue-950/80 px-2 py-0.5 rounded">
                          Saved in Order Record
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-500 font-medium mb-1 text-[11px]">Bank Name</label>
                          <input
                            type="text"
                            value={bankTransferDetails.bankName}
                            onChange={(e) => setBankTransferDetails(prev => ({ ...prev, bankName: e.target.value }))}
                            placeholder="e.g. State Bank of India"
                            className="w-full h-8 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1 text-[11px]">Account Number</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={bankTransferDetails.accountNo}
                              onChange={(e) => setBankTransferDetails(prev => ({ ...prev, accountNo: e.target.value }))}
                              placeholder="e.g. 123456789012"
                              className="w-full h-8 pl-2.5 pr-8 text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                            />
                            {bankTransferDetails.accountNo && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(bankTransferDetails.accountNo, 'Account Number')}
                                className="absolute right-2 top-2 text-slate-400 hover:text-blue-600 cursor-pointer"
                                title="Copy Account Number"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1 text-[11px]">IFSC Code</label>
                          <input
                            type="text"
                            value={bankTransferDetails.ifsc}
                            onChange={(e) => setBankTransferDetails(prev => ({ ...prev, ifsc: e.target.value.toUpperCase() }))}
                            placeholder="e.g. SBIN0001234"
                            className="w-full h-8 px-2.5 text-xs font-mono uppercase font-bold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1 text-[11px]">Branch Name</label>
                          <input
                            type="text"
                            value={bankTransferDetails.branch}
                            onChange={(e) => setBankTransferDetails(prev => ({ ...prev, branch: e.target.value }))}
                            placeholder="e.g. Salem Main Branch"
                            className="w-full h-8 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-500 font-medium mb-1 text-[11px]">UTR / Transaction Reference No.</label>
                        <input
                          type="text"
                          value={bankTransferDetails.transactionRef}
                          onChange={(e) => setBankTransferDetails(prev => ({ ...prev, transactionRef: e.target.value }))}
                          placeholder="e.g. UTR-20261014-998811"
                          className="w-full h-8 px-2.5 text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Mode: Cash Counter */}
                  {paymentMethod === 'Cash' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-900/60 pb-2">
                        <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 text-xs">
                          <Banknote className="w-4 h-4 text-emerald-600" />
                          <span>Cash Counter Settlement</span>
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded">
                          Physical Drawer Settlement
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-500 font-medium mb-1 text-[11px]">Cash Tendered / Received (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={cashDetails.cashReceived || advancePaid}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setCashDetails(prev => ({ ...prev, cashReceived: val }));
                              setAdvancePaid(val);
                            }}
                            className="w-full h-8 px-2.5 text-right font-mono font-bold text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1 text-[11px]">Change to Return (₹)</label>
                          <div className="w-full h-8 px-2.5 flex items-center justify-end font-mono font-bold text-sm bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                            ₹{Math.max(0, (Number(cashDetails.cashReceived || advancePaid) || 0) - financials.grandTotal).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-500 font-medium mb-1 text-[11px]">Cashier / Handover Notes</label>
                        <input
                          type="text"
                          value={cashDetails.cashierNote}
                          onChange={(e) => setCashDetails(prev => ({ ...prev, cashierNote: e.target.value }))}
                          placeholder="e.g. Received at Counter 1 / Handed over to main accounts safe"
                          className="w-full h-8 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Mode: UPI / QR */}
                  {paymentMethod.includes('UPI') && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-purple-200 dark:border-purple-900/60 pb-2">
                        <span className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5 text-xs">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                          <span>UPI & Mobile QR Settlement Details</span>
                        </span>
                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold bg-purple-100 dark:bg-purple-950/80 px-2 py-0.5 rounded">
                          Instant App Settlement
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-500 font-medium mb-1 text-[11px]">Merchant / Customer UPI ID</label>
                          <input
                            type="text"
                            value={upiDetails.upiId}
                            onChange={(e) => setUpiDetails(prev => ({ ...prev, upiId: e.target.value }))}
                            placeholder="e.g. business@upi or 9940454154@ybl"
                            className="w-full h-8 px-2.5 text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1 text-[11px]">Registered Mobile Number</label>
                          <input
                            type="text"
                            value={upiDetails.mobileNo}
                            onChange={(e) => setUpiDetails(prev => ({ ...prev, mobileNo: e.target.value }))}
                            placeholder="e.g. +91 99404 54154"
                            className="w-full h-8 px-2.5 text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-500 font-medium mb-1 text-[11px]">UPI Ref / UTR No.</label>
                        <input
                          type="text"
                          value={upiDetails.utrRef}
                          onChange={(e) => setUpiDetails(prev => ({ ...prev, utrRef: e.target.value }))}
                          placeholder="e.g. UPI-9988221100"
                          className="w-full h-8 px-2.5 text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Mode: Credit / Debit Card */}
                  {paymentMethod.includes('Card') && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-900/60 pb-2">
                        <span className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 text-xs">
                          <CreditCard className="w-4 h-4 text-amber-600" />
                          <span>Card POS Machine & Terminal Settlement</span>
                        </span>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded">
                          POS Auth Code
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-500 font-medium mb-1 text-[11px]">Card Last 4 Digits</label>
                          <input
                            type="text"
                            maxLength={4}
                            value={cardDetails.cardLast4}
                            onChange={(e) => setCardDetails(prev => ({ ...prev, cardLast4: e.target.value }))}
                            placeholder="e.g. 4589"
                            className="w-full h-8 px-2.5 text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1 text-[11px]">Card Network</label>
                          <select
                            value={cardDetails.cardNetwork}
                            onChange={(e) => setCardDetails(prev => ({ ...prev, cardNetwork: e.target.value }))}
                            className="w-full h-8 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-amber-500"
                          >
                            <option value="Visa">Visa</option>
                            <option value="MasterCard">MasterCard</option>
                            <option value="RuPay">RuPay</option>
                            <option value="American Express">American Express</option>
                            <option value="Maestro">Maestro</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-500 font-medium mb-1 text-[11px]">POS Terminal / Auth Approval Code</label>
                        <input
                          type="text"
                          value={cardDetails.terminalCode}
                          onChange={(e) => setCardDetails(prev => ({ ...prev, terminalCode: e.target.value }))}
                          placeholder="e.g. AUTH-992211"
                          className="w-full h-8 px-2.5 text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Mode: Cheque */}
                  {paymentMethod === 'Cheque' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-indigo-200 dark:border-indigo-900/60 pb-2">
                        <span className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5 text-xs">
                          <FileText className="w-4 h-4 text-indigo-600" />
                          <span>Cheque / Demand Draft Record</span>
                        </span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-100 dark:bg-indigo-950/80 px-2 py-0.5 rounded">
                          Clearing Tracked
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-500 font-medium mb-1 text-[11px]">Cheque / DD Number</label>
                          <input
                            type="text"
                            value={chequeDetails.chequeNo}
                            onChange={(e) => setChequeDetails(prev => ({ ...prev, chequeNo: e.target.value }))}
                            placeholder="e.g. 000452"
                            className="w-full h-8 px-2.5 text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1 text-[11px]">Drawn Bank</label>
                          <input
                            type="text"
                            value={chequeDetails.bankName}
                            onChange={(e) => setChequeDetails(prev => ({ ...prev, bankName: e.target.value }))}
                            placeholder="e.g. HDFC Bank"
                            className="w-full h-8 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1 text-[11px]">Cheque Date</label>
                          <input
                            type="date"
                            value={chequeDetails.chequeDate}
                            onChange={(e) => setChequeDetails(prev => ({ ...prev, chequeDate: e.target.value }))}
                            className="w-full h-8 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1 text-[11px]">Clearance Status</label>
                          <select
                            value={chequeDetails.clearanceStatus}
                            onChange={(e) => setChequeDetails(prev => ({ ...prev, clearanceStatus: e.target.value }))}
                            className="w-full h-8 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                          >
                            <option value="Pending">Pending Clearance</option>
                            <option value="Cleared">Cleared</option>
                            <option value="Bounced">Bounced / Returned</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column (Cols 5): General Ledger Double-Entry & PDF Terms */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* SAP B1 General Ledger Double-Entry Preview Card */}
                <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                      <FileSpreadsheet className="w-4 h-4 text-amber-500" />
                      <span>SAP B1 General Ledger Double-Entry Preview</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      Balanced
                    </span>
                  </div>

                  {/* GL Account Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-1.5 px-2 text-left">Account Description</th>
                          <th className="py-1.5 px-2 text-right">Debit (₹)</th>
                          <th className="py-1.5 px-2 text-right">Credit (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                        <tr>
                          <td className="py-1.5 px-2 font-sans font-semibold text-slate-800 dark:text-slate-200">
                            Trade Debtors: {selectedCustomer?.name || 'Customer Control'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-bold text-blue-700 dark:text-blue-300">
                            {financials.grandTotal.toFixed(2)}
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-400">-</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2 font-sans text-slate-600 dark:text-slate-400 pl-4">
                            ↳ Sales Revenue (Goods Subtotal)
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-400">-</td>
                          <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300">
                            {financials.taxableSubtotal.toFixed(2)}
                          </td>
                        </tr>
                        {!isInterState ? (
                          <>
                            <tr>
                              <td className="py-1.5 px-2 font-sans text-slate-600 dark:text-slate-400 pl-4">
                                ↳ Output CGST Payable (Central)
                              </td>
                              <td className="py-1.5 px-2 text-right text-slate-400">-</td>
                              <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300">
                                {financials.cgst.toFixed(2)}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-1.5 px-2 font-sans text-slate-600 dark:text-slate-400 pl-4">
                                ↳ Output SGST Payable (State)
                              </td>
                              <td className="py-1.5 px-2 text-right text-slate-400">-</td>
                              <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300">
                                {financials.sgst.toFixed(2)}
                              </td>
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <td className="py-1.5 px-2 font-sans text-slate-600 dark:text-slate-400 pl-4">
                              ↳ Output IGST Payable (Integrated)
                            </td>
                            <td className="py-1.5 px-2 text-right text-slate-400">-</td>
                            <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300">
                              {financials.igst.toFixed(2)}
                            </td>
                          </tr>
                        )}
                        {(financials.totalChargesAmount || 0) > 0 && (
                          <tr>
                            <td className="py-1.5 px-2 font-sans text-slate-600 dark:text-slate-400 pl-4">
                              ↳ Ancillary Recoveries (Logistics)
                            </td>
                            <td className="py-1.5 px-2 text-right text-slate-400">-</td>
                            <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300">
                              {(financials.totalChargesAmount || 0).toFixed(2)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                        <tr>
                          <td className="py-1.5 px-2 font-sans">Total Balanced Entry</td>
                          <td className="py-1.5 px-2 text-right font-mono text-emerald-700 dark:text-emerald-400">
                            ₹{financials.grandTotal.toFixed(2)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-emerald-700 dark:text-emerald-400">
                            ₹{financials.grandTotal.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Journal Remark */}
                  <div>
                    <label className="block text-slate-500 font-medium mb-1 text-[11px]">General Ledger Remark</label>
                    <input
                      type="text"
                      readOnly
                      value={`Sales Order #${docNo || editOrderId || 'NEW'} - ${selectedCustomer?.name || 'Customer'}`}
                      className="w-full h-8 px-2.5 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none"
                    />
                  </div>
                </div>

                {/* Statutory Terms & Conditions Card (Printed on PDF) */}
                <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                      <FileText className="w-4 h-4 text-amber-500" />
                      <span>Order Terms & Conditions (PDF Print)</span>
                    </span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                      Editable per Order
                    </span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setOrderTerms('1. Payment terms: Net 30 days from date of invoice.\n2. Goods once dispatched cannot be returned without prior authorization.\n3. Subject to Salem jurisdiction only.')}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      + Net 30 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderTerms('1. 100% advance payment required prior to dispatch.\n2. Delivery timeline: 3-5 working days from payment realization.\n3. Subject to Salem jurisdiction.')}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      + 100% Advance
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderTerms('1. 50% advance on order confirmation, balance 50% against delivery.\n2. QC inspection on arrival.\n3. Subject to Salem jurisdiction.')}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      + 50/50 Split
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={orderTerms}
                    onChange={(e) => setOrderTerms(e.target.value)}
                    placeholder="Enter custom terms and conditions to print on this order's PDF invoice..."
                    className="w-full p-2.5 text-xs font-sans border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 leading-relaxed"
                  />
                  <div className="text-[10.5px] text-slate-400 dark:text-slate-500 italic">
                    * Saved directly in database for this order and prints on all generated PDF invoices.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TAX ACCOUNTING & GST STUDIO */}
        {activeTab === 'tax' && (
          <div className="w-full space-y-4">
            
            {/* Top Statutory GST KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Taxable Goods Card */}
              <div className="p-3.5 rounded-lg bg-gradient-to-br from-blue-500/10 via-slate-50 to-white dark:from-blue-950/30 dark:via-slate-850 dark:to-slate-900 border border-blue-200 dark:border-blue-900/60 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Taxable Base (Goods)</span>
                  </span>
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400">
                    Net Value
                  </span>
                </div>
                <div className="text-xl font-mono font-black text-slate-900 dark:text-white">
                  ₹{financials.taxableSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  After item discounts (₹{(financials.lineDiscountTotal || 0).toFixed(2)})
                </div>
              </div>

              {/* Ancillary Charges Card */}
              <div className="p-3.5 rounded-lg bg-gradient-to-br from-indigo-500/10 via-slate-50 to-white dark:from-indigo-950/30 dark:via-slate-850 dark:to-slate-900 border border-indigo-200 dark:border-indigo-900/60 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Logistics & Ancillary</span>
                  </span>
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400">
                    Recoveries
                  </span>
                </div>
                <div className="text-xl font-mono font-black text-slate-900 dark:text-white">
                  ₹{(financials.totalChargesAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  Freight + Loading + Packing + Other
                </div>
              </div>

              {/* Tax Split Card */}
              <div className="p-3.5 rounded-lg bg-gradient-to-br from-amber-500/10 via-slate-50 to-white dark:from-amber-950/30 dark:via-slate-850 dark:to-slate-900 border border-amber-200 dark:border-amber-900/60 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  <span className="flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Statutory Tax Split</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    {isInterState ? 'IGST' : 'CGST + SGST'}
                  </span>
                </div>
                {!isInterState ? (
                  <div className="text-sm font-mono font-black text-slate-900 dark:text-white flex items-center justify-between">
                    <span>CGST: ₹{financials.cgst.toFixed(2)}</span>
                    <span className="text-slate-400">|</span>
                    <span>SGST: ₹{financials.sgst.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="text-xl font-mono font-black text-blue-700 dark:text-blue-400">
                    IGST: ₹{financials.igst.toFixed(2)}
                  </div>
                )}
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {isInterState ? 'Inter-State Supply to other state' : 'Intra-State Supply (50% Central / 50% State)'}
                </div>
              </div>

              {/* Total Tax Liability Card */}
              <div className="p-3.5 rounded-lg bg-gradient-to-br from-emerald-500/10 via-slate-50 to-white dark:from-emerald-950/30 dark:via-slate-850 dark:to-slate-900 border border-emerald-200 dark:border-emerald-900/60 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Total GST Tax Liability</span>
                  </span>
                  <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
                    GSTR-1 Outward
                  </span>
                </div>
                <div className="text-xl font-mono font-black text-emerald-700 dark:text-emerald-400">
                  ₹{financials.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10.5px] text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
                  <Check className="w-3 h-3" />
                  <span>100% Statutory Compliant</span>
                </div>
              </div>
            </div>

            {/* GST Intelligence & Place of Supply Configuration */}
            <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>GST Treatment, Place of Supply & Tax Jurisdiction</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                    Section 10 & 12 IGST Act Rules
                  </span>
                  {hasCustomerGstin && (
                    <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Locked by GSTIN</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Customer GSTIN */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1 text-[11px]">
                    Customer GSTIN / Tax Identification
                  </label>
                  <input
                    type="text"
                    value={taxRegNo}
                    onChange={(e) => handleGstinInputChange(e.target.value)}
                    placeholder="33AAAAA0000A1Z5"
                    className="w-full h-9 px-3 font-mono font-bold text-xs uppercase border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">
                    First 2 digits automatically configure place of supply state code.
                  </div>
                </div>

                {/* Place of Supply Dropdown */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1 text-[11px]">
                    Place of Supply (Delivery Destination)
                  </label>
                  <select
                    value={placeOfSupply}
                    disabled={hasCustomerGstin}
                    onChange={(e) => handlePlaceOfSupplyChange(e.target.value)}
                    className={`w-full h-9 px-3 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-md outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      hasCustomerGstin
                        ? 'bg-slate-100 dark:bg-slate-850 text-slate-500 cursor-not-allowed'
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
                    }`}
                  >
                    {getIndianStates().map(st => (
                      <option key={st.code} value={st.code}>
                        {st.code} - {st.name} {String(st.code) === String(supplierStateCode) ? '(Home State)' : ''}
                      </option>
                    ))}
                  </select>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {hasCustomerGstin ? '🔒 Auto-set from customer GSTIN' : 'Select buyer state of delivery'}
                  </div>
                </div>

                {/* Tax Supply Type Switcher */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1 text-[11px]">
                    Tax Classification Rule
                  </label>
                  {hasCustomerGstin ? (
                    <div className="h-9 px-3 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-between text-xs font-bold">
                      <span className={isInterState ? 'text-blue-700 dark:text-blue-400' : 'text-emerald-700 dark:text-emerald-400'}>
                        {isInterState ? '🌐 INTER-STATE (IGST 100%)' : '🏛️ INTRA-STATE (CGST + SGST 50/50)'}
                      </span>
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 h-9 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => handleTaxSupplyTypeChange('INTRA_STATE')}
                        className={`flex-1 h-full rounded text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          !isInterState
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        <span>🏛️ Intra-State</span>
                        <span className="text-[9.5px] opacity-80">(CGST+SGST)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTaxSupplyTypeChange('INTER_STATE')}
                        className={`flex-1 h-full rounded text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          isInterState
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        <span>🌐 Inter-State</span>
                        <span className="text-[9.5px] opacity-80">(IGST)</span>
                      </button>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 mt-1">
                    {isInterState ? 'Supplier State ≠ Buyer State' : 'Supplier State = Buyer State'}
                  </div>
                </div>
              </div>

              {/* Supply Flow Route Diagram */}
              <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span>Origin: <strong>{getIndianStateName(supplierStateCode)} ({supplierStateCode})</strong></span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Destination (POS): <strong>{getIndianStateName(placeOfSupply)} ({placeOfSupply})</strong></span>
                  </div>
                </div>
                <div className={`px-2.5 py-1 rounded font-bold text-xs flex items-center gap-1.5 ${
                  isInterState
                    ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300'
                    : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isInterState ? 'IGST Applicable • Form GSTR-1 Table 5' : 'CGST + SGST Applicable • Form GSTR-1 Table 4'}</span>
                </div>
              </div>
            </div>

            {/* Comprehensive Statutory HSN / SAC Summary Table */}
            <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  <span>Statutory HSN / SAC Tax Summary (Form GSTR-1 Table 12 Compliant)</span>
                </div>
                <span className="text-[10.5px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold">
                  {financials.gstCalcResult?.hsnSummary?.length || 1} HSN Slabs
                </span>
              </div>

              {/* HSN Summary Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2 px-3 text-left">HSN / SAC</th>
                      <th className="py-2 px-3 text-left">Description / Type</th>
                      <th className="py-2 px-3 text-center">Tax Slab</th>
                      <th className="py-2 px-3 text-right">Taxable Value (₹)</th>
                      {!isInterState ? (
                        <>
                          <th className="py-2 px-3 text-right">CGST (₹)</th>
                          <th className="py-2 px-3 text-right">SGST (₹)</th>
                        </>
                      ) : (
                        <th className="py-2 px-3 text-right">IGST (₹)</th>
                      )}
                      <th className="py-2 px-3 text-right">Total GST (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
                    {financials.gstCalcResult?.hsnSummary && financials.gstCalcResult.hsnSummary.length > 0 ? (
                      financials.gstCalcResult.hsnSummary.map((hsnRow, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                            {hsnRow.hsnCode}
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">
                            {hsnRow.hsnCode === '9965' ? 'Freight & Transport Services' : 'Manufactured Goods / Foam Products'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                              {hsnRow.gstRate}%
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                            ₹{(hsnRow.taxableAmount || 0).toFixed(2)}
                          </td>
                          {!isInterState ? (
                            <>
                              <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                                ₹{(hsnRow.cgstAmount || 0).toFixed(2)}
                                <span className="block text-[9.5px] text-slate-400 font-sans">@{hsnRow.cgstRate}%</span>
                              </td>
                              <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                                ₹{(hsnRow.sgstAmount || 0).toFixed(2)}
                                <span className="block text-[9.5px] text-slate-400 font-sans">@{hsnRow.sgstRate}%</span>
                              </td>
                            </>
                          ) : (
                            <td className="py-2 px-3 text-right text-blue-700 dark:text-blue-300 font-bold">
                              ₹{(hsnRow.igstAmount || 0).toFixed(2)}
                              <span className="block text-[9.5px] text-slate-400 font-sans">@{hsnRow.igstRate}%</span>
                            </td>
                          )}
                          <td className="py-2 px-3 text-right font-black text-emerald-700 dark:text-emerald-400">
                            ₹{(hsnRow.totalTax || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">21050000</td>
                        <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">Standard Goods</td>
                        <td className="py-2 px-3 text-center font-bold">18%</td>
                        <td className="py-2 px-3 text-right font-bold">₹{financials.taxableSubtotal.toFixed(2)}</td>
                        {!isInterState ? (
                          <>
                            <td className="py-2 px-3 text-right">₹{financials.cgst.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right">₹{financials.sgst.toFixed(2)}</td>
                          </>
                        ) : (
                          <td className="py-2 px-3 text-right font-bold text-blue-600">₹{financials.igst.toFixed(2)}</td>
                        )}
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">₹{financials.totalTax.toFixed(2)}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/90 font-bold border-t border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-3 font-sans">
                        Total Statutory Outward Tax Base
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                        ₹{(financials.taxableSubtotal + (financials.totalChargesAmount || 0)).toFixed(2)}
                      </td>
                      {!isInterState ? (
                        <>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                            ₹{financials.cgst.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                            ₹{financials.sgst.toFixed(2)}
                          </td>
                        </>
                      ) : (
                        <td className="py-2.5 px-3 text-right font-mono font-black text-blue-700 dark:text-blue-300">
                          ₹{financials.igst.toFixed(2)}
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700 dark:text-emerald-400">
                        ₹{financials.totalTax.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Ancillary Logistics Charges & Tax Matrix (2x2 Grid) */}
            <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                  <Calculator className="w-4 h-4 text-amber-500" />
                  <span>Ancillary Charges & GST Tax Code Ledger</span>
                </div>
                <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  Select applicable GST tax code for each service charge
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Freight */}
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                      <Truck className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Freight & Logistics (₹)</span>
                    </label>
                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400">
                      SAC 9965
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={freight}
                      onChange={(e) => setFreight(parseFloat(e.target.value) || 0)}
                      className="w-32 h-8 px-2.5 text-right font-mono font-bold text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <select
                      value={freightTaxCode}
                      onChange={(e) => handleFreightTaxCodeChange(e.target.value)}
                      className="flex-1 h-8 px-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer focus:border-indigo-500"
                    >
                      {!isInterState ? (
                        <>
                          <option value="EXEMPT">EXEMPT (0%)</option>
                          <option value="SCG5">SCG5 (5% - CGST 2.5% + SGST 2.5%)</option>
                          <option value="SCG9">SCG9 (9% - CGST 4.5% + SGST 4.5%)</option>
                          <option value="SCG12">SCG12 (12% - CGST 6% + SGST 6%)</option>
                          <option value="SCG18">SCG18 (18% - CGST 9% + SGST 9%)</option>
                          <option value="SCG28">SCG28 (28% - CGST 14% + SGST 14%)</option>
                        </>
                      ) : (
                        <>
                          <option value="EXEMPT">EXEMPT (0%)</option>
                          <option value="IGST5">IGST5 (5% - IGST 5%)</option>
                          <option value="IGST9">IGST9 (9% - IGST 9%)</option>
                          <option value="IGST12">IGST12 (12% - IGST 12%)</option>
                          <option value="IGST18">IGST18 (18% - IGST 18%)</option>
                          <option value="IGST28">IGST28 (28% - IGST 28%)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* 2. Packing */}
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                      <Package className="w-3.5 h-3.5 text-amber-500" />
                      <span>Packing Charges (₹)</span>
                    </label>
                    {packingItemsSum > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPackingCharges(Number(packingItemsSum.toFixed(2)));
                          setStatusMessage({
                            type: 'ready',
                            text: `✔ Synced ₹${packingItemsSum.toFixed(2)} from document lines marked as packing charges.`
                          });
                        }}
                        className="text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold px-2 py-0.5 rounded cursor-pointer transition-colors"
                        title="Auto-fill total from document lines where Packing? is checked"
                      >
                        Sync Lines (₹{packingItemsSum.toFixed(2)})
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold">SAC 9985</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={packingCharges}
                      onChange={(e) => handlePackingAmountChange(parseFloat(e.target.value) || 0)}
                      className="w-32 h-8 px-2.5 text-right font-mono font-bold text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    />
                    <select
                      value={packingTaxCode}
                      onChange={(e) => handlePackingTaxCodeChange(e.target.value)}
                      className="flex-1 h-8 px-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer focus:border-amber-500"
                    >
                      {!isInterState ? (
                        <>
                          <option value="EXEMPT">EXEMPT (0%)</option>
                          <option value="SCG5">SCG5 (5% - CGST 2.5% + SGST 2.5%)</option>
                          <option value="SCG9">SCG9 (9% - CGST 4.5% + SGST 4.5%)</option>
                          <option value="SCG12">SCG12 (12% - CGST 6% + SGST 6%)</option>
                          <option value="SCG18">SCG18 (18% - CGST 9% + SGST 9%)</option>
                          <option value="SCG28">SCG28 (28% - CGST 14% + SGST 14%)</option>
                        </>
                      ) : (
                        <>
                          <option value="EXEMPT">EXEMPT (0%)</option>
                          <option value="IGST5">IGST5 (5% - IGST 5%)</option>
                          <option value="IGST9">IGST9 (9% - IGST 9%)</option>
                          <option value="IGST12">IGST12 (12% - IGST 12%)</option>
                          <option value="IGST18">IGST18 (18% - IGST 18%)</option>
                          <option value="IGST28">IGST28 (28% - IGST 28%)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* 3. Loading */}
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                      <Boxes className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Loading & Handling Charges (₹)</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-bold">SAC 9967</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={loadingCharges}
                      onChange={(e) => handleLoadingAmountChange(parseFloat(e.target.value) || 0)}
                      className="w-32 h-8 px-2.5 text-right font-mono font-bold text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                    <select
                      value={loadingTaxCode}
                      onChange={(e) => handleLoadingTaxCodeChange(e.target.value)}
                      className="flex-1 h-8 px-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer focus:border-emerald-500"
                    >
                      {!isInterState ? (
                        <>
                          <option value="EXEMPT">EXEMPT (0%)</option>
                          <option value="SCG5">SCG5 (5% - CGST 2.5% + SGST 2.5%)</option>
                          <option value="SCG9">SCG9 (9% - CGST 4.5% + SGST 4.5%)</option>
                          <option value="SCG12">SCG12 (12% - CGST 6% + SGST 6%)</option>
                          <option value="SCG18">SCG18 (18% - CGST 9% + SGST 9%)</option>
                          <option value="SCG28">SCG28 (28% - CGST 14% + SGST 14%)</option>
                        </>
                      ) : (
                        <>
                          <option value="EXEMPT">EXEMPT (0%)</option>
                          <option value="IGST5">IGST5 (5% - IGST 5%)</option>
                          <option value="IGST9">IGST9 (9% - IGST 9%)</option>
                          <option value="IGST12">IGST12 (12% - IGST 12%)</option>
                          <option value="IGST18">IGST18 (18% - IGST 18%)</option>
                          <option value="IGST28">IGST28 (28% - IGST 28%)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* 4. Other Charges */}
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                      <Percent className="w-3.5 h-3.5 text-purple-500" />
                      <span>Other Ancillary Charges (₹)</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-bold">SAC 9997</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={otherCharges}
                      onChange={(e) => handleOtherAmountChange(parseFloat(e.target.value) || 0)}
                      className="w-32 h-8 px-2.5 text-right font-mono font-bold text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                    />
                    <select
                      value={otherTaxCode}
                      onChange={(e) => handleOtherTaxCodeChange(e.target.value)}
                      className="flex-1 h-8 px-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer focus:border-purple-500"
                    >
                      {!isInterState ? (
                        <>
                          <option value="EXEMPT">EXEMPT (0%)</option>
                          <option value="SCG5">SCG5 (5% - CGST 2.5% + SGST 2.5%)</option>
                          <option value="SCG9">SCG9 (9% - CGST 4.5% + SGST 4.5%)</option>
                          <option value="SCG12">SCG12 (12% - CGST 6% + SGST 6%)</option>
                          <option value="SCG18">SCG18 (18% - CGST 9% + SGST 9%)</option>
                          <option value="SCG28">SCG28 (28% - CGST 14% + SGST 14%)</option>
                        </>
                      ) : (
                        <>
                          <option value="EXEMPT">EXEMPT (0%)</option>
                          <option value="IGST5">IGST5 (5% - IGST 5%)</option>
                          <option value="IGST9">IGST9 (9% - IGST 9%)</option>
                          <option value="IGST12">IGST12 (12% - IGST 12%)</option>
                          <option value="IGST18">IGST18 (18% - IGST 18%)</option>
                          <option value="IGST28">IGST28 (28% - IGST 28%)</option>
                        </>
                      )}
                    </select>
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
                        {(() => {
                          const isPdf = att.filename?.toLowerCase().endsWith('.pdf') || att.url?.toLowerCase().includes('.pdf');
                          const fullUrl = getFullAttachmentUrl(att.url);
                          return (
                            <div
                              onClick={() => {
                                if (isPdf) {
                                  window.open(fullUrl, '_blank');
                                } else {
                                  setPreviewModalUrl(fullUrl);
                                }
                              }}
                              className="w-16 h-16 rounded-xs bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600 cursor-pointer relative group-hover:opacity-90 flex items-center justify-center"
                              title={isPdf ? 'Click to open PDF' : 'Click to preview image'}
                            >
                              {isPdf ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                                  <FileText className="w-6 h-6" />
                                  <span className="text-[9px] font-bold mt-0.5 tracking-wider">PDF</span>
                                </div>
                              ) : (
                                <img
                                  src={fullUrl}
                                  alt={att.filename}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="100%" height="100%" fill="%23cbd5e1"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="10" fill="%23475569">Doc</text></svg>';
                                  }}
                                />
                              )}
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Eye className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          );
                        })()}

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
                          title="Retake camera photo to update and replace this attachment"
                        >
                          <Camera className="w-3 h-3 text-amber-700" />
                          <span>Update Photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTriggerUpdate(att.id, 'gallery')}
                          className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-xs text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer"
                          title="Replace with an image or PDF from device gallery"
                        >
                          <ImageIcon className="w-3 h-3 text-slate-600" />
                          <span>Update Gallery</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const isPdf = att.filename?.toLowerCase().endsWith('.pdf') || att.url?.toLowerCase().includes('.pdf');
                            const fullUrl = getFullAttachmentUrl(att.url);
                            if (isPdf) {
                              window.open(fullUrl, '_blank');
                            } else {
                              setPreviewModalUrl(fullUrl);
                            }
                          }}
                          className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-xs text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                        <a
                          href={getFullAttachmentUrl(att.url)}
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
                          onClick={() => handleRemoveAttachment(att)}
                          className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xs text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer"
                          title="Permanently remove file from server uploads"
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
          
          {/* Total Product Amount (Finished Products & Raw Materials where Packing? is not checked) */}
          <div className="flex items-center justify-end w-full max-w-[480px]">
            <label className="flex-1 text-[var(--sap-text-muted)] font-semibold pr-3 text-right">Total Product Amount</label>
            <input
              type="text"
              readOnly
              value={`₹${(financials.totalProductAmount !== undefined ? financials.totalProductAmount : financials.totalBeforeDiscount).toFixed(2)} INR`}
              className="w-40 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
            />
          </div>

          {/* Discount Amount with % and ₹ Option */}
          <div className="flex items-center justify-end w-full max-w-[480px] gap-1">
            <div className="flex-1 flex items-center justify-end gap-1.5 pr-2">
              <label className="text-[var(--sap-text-muted)] font-semibold text-right">Discount</label>
              {/* % or ₹ Mode Toggle */}
              <div className="inline-flex rounded-xs border border-[var(--sap-border-inner)] bg-[var(--sap-bg-window)] p-0.5 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setDiscountMode('percent')}
                  className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer ${
                    discountMode === 'percent'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="Percentage Mode (%)"
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountMode('amount')}
                  className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer ${
                    discountMode === 'amount'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="Direct Rupee Amount (₹)"
                >
                  ₹
                </button>
              </div>
            </div>

            {discountMode === 'percent' ? (
              <div className="flex items-center gap-0.5">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => {
                    const pct = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                    setDiscountPercent(pct);
                    const netSub = Math.max(0, financials.totalBeforeDiscount - financials.lineDiscountTotal);
                    setDiscountAmountInput(round2(netSub * (pct / 100)));
                  }}
                  className="w-16 h-[24px] px-1 text-right font-mono font-bold border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                  title="Discount Percentage (%)"
                />
                <span className="text-[var(--sap-text-muted)] text-[11px] font-bold">%</span>
              </div>
            ) : (
              <div className="flex items-center gap-0.5">
                <span className="text-[var(--sap-text-muted)] text-[11px] font-bold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountAmountInput}
                  onChange={(e) => {
                    const amt = Math.max(0, parseFloat(e.target.value) || 0);
                    setDiscountAmountInput(amt);
                    const netSub = Math.max(0, financials.totalBeforeDiscount - financials.lineDiscountTotal);
                    const pct = netSub > 0 ? (amt / netSub) * 100 : 0;
                    setDiscountPercent(round2(pct));
                  }}
                  className="w-16 h-[24px] px-1 text-right font-mono font-bold border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                  title="Direct Rupee Amount (₹)"
                />
              </div>
            )}

            <input
              type="text"
              readOnly
              value={`-₹${financials.docDiscAmt.toFixed(2)} INR`}
              className="w-40 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-rose-600 dark:text-rose-400 outline-none"
            />
          </div>

          {/* Freight & Logistics Charges */}
          <div className="flex items-center justify-end w-full max-w-[480px] gap-1">
            <div className="flex-1 flex items-center justify-end gap-1 pr-2 truncate">
              <label className="text-[var(--sap-text-muted)] font-semibold text-right text-[11.5px] truncate">
                Freight & Logistics Charges
              </label>
              <span
                className={`text-[9.5px] px-1 py-0.2 rounded font-mono font-bold shrink-0 ${
                  getTaxRateFromCode(freightTaxCode) > 0
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
                title={`Freight Tax Code: ${freightTaxCode} (${getTaxRateFromCode(freightTaxCode)}%)`}
              >
                {getChargeBadgeText(freightTaxCode)}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('tax')}
                className="text-amber-600 font-extrabold hover:scale-125 cursor-pointer text-xs"
                title="Configure Freight Tax Code in Tax Tab"
              >
                ➔
              </button>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* % Input */}
              <div className="flex items-center gap-0.5">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={freightPercent}
                  onChange={(e) => handleFreightPercentChange(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-12 h-[24px] px-1 text-right font-mono font-bold text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                  title="Freight Percentage (%) of total amount"
                />
                <span className="text-[var(--sap-text-muted)] text-[10.5px] font-bold">%</span>
              </div>
              {/* ₹ Amount Input */}
              <div className="relative flex items-center">
                <span className="absolute left-1 text-[11px] font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={freight}
                  onChange={(e) => handleFreightAmountChange(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-16 h-[24px] pl-3.5 pr-1 text-right font-mono font-bold text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                  title="Enter Freight Amount in INR (₹)"
                />
              </div>
              <input
                type="text"
                readOnly
                value={`₹${(Number(freight) || 0).toFixed(2)} INR`}
                className="w-40 h-[24px] px-2 text-right font-mono font-semibold text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
              />
            </div>
          </div>

          {/* Package Charges (Auto-Calculated from Packing lines or Manual) */}
          <div className="flex items-center justify-end w-full max-w-[480px] gap-1">
            <div className="flex-1 flex items-center justify-end gap-1 pr-2 truncate">
              <label className="text-[var(--sap-text-muted)] font-semibold text-right text-[11.5px] truncate">Package Charges</label>
              {packingItemsSum > 0 && (
                <span
                  className="text-[9.5px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1 py-0.2 rounded font-bold shrink-0"
                  title={`Auto-calculated ₹${packingItemsSum.toFixed(2)} from document lines marked as Packing?`}
                >
                  📦 Auto
                </span>
              )}
              <span
                className={`text-[9.5px] px-1 py-0.2 rounded font-mono font-bold shrink-0 ${
                  getTaxRateFromCode(packingTaxCode) > 0
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
                title={`Packing Tax Code: ${packingTaxCode} (${getTaxRateFromCode(packingTaxCode)}%)`}
              >
                {getChargeBadgeText(packingTaxCode)}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('tax')}
                className="text-amber-600 font-extrabold hover:scale-125 cursor-pointer text-xs"
                title="Configure Packing Tax Code in Tax Tab"
              >
                ➔
              </button>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* % Input */}
              <div className="flex items-center gap-0.5">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={packingPercent}
                  onChange={(e) => handlePackingPercentChange(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-12 h-[24px] px-1 text-right font-mono font-bold text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                  title="Packing Percentage (%) of total amount"
                />
                <span className="text-[var(--sap-text-muted)] text-[10.5px] font-bold">%</span>
              </div>
              {/* ₹ Amount Input */}
              <div className="relative flex items-center">
                <span className="absolute left-1 text-[11px] font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={packingCharges}
                  onChange={(e) => handlePackingAmountChange(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-16 h-[24px] pl-3.5 pr-1 text-right font-mono font-bold text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                  title="Packing Charges Amount in INR (₹)"
                />
              </div>
              <input
                type="text"
                readOnly
                value={`₹${(Number(packingCharges) || 0).toFixed(2)} INR`}
                className="w-40 h-[24px] px-2 text-right font-mono font-semibold text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
              />
            </div>
          </div>

          {/* Loading Charges */}
          <div className="flex items-center justify-end w-full max-w-[480px] gap-1">
            <div className="flex-1 flex items-center justify-end gap-1 pr-2 truncate">
              <label className="text-[var(--sap-text-muted)] font-semibold text-right text-[11.5px] truncate">
                Loading Charges
              </label>
              <span
                className={`text-[9.5px] px-1 py-0.2 rounded font-mono font-bold shrink-0 ${
                  getTaxRateFromCode(loadingTaxCode) > 0
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
                title={`Loading Tax Code: ${loadingTaxCode} (${getTaxRateFromCode(loadingTaxCode)}%)`}
              >
                {getChargeBadgeText(loadingTaxCode)}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('tax')}
                className="text-amber-600 font-extrabold hover:scale-125 cursor-pointer text-xs"
                title="Configure Loading Tax Code in Tax Tab"
              >
                ➔
              </button>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* % Input */}
              <div className="flex items-center gap-0.5">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={loadingPercent}
                  onChange={(e) => handleLoadingPercentChange(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-12 h-[24px] px-1 text-right font-mono font-bold text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                  title="Loading Percentage (%) of total amount"
                />
                <span className="text-[var(--sap-text-muted)] text-[10.5px] font-bold">%</span>
              </div>
              {/* ₹ Amount Input */}
              <div className="relative flex items-center">
                <span className="absolute left-1 text-[11px] font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={loadingCharges}
                  onChange={(e) => handleLoadingAmountChange(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-16 h-[24px] pl-3.5 pr-1 text-right font-mono font-bold text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                  title="Loading Charges Amount in INR (₹)"
                />
              </div>
              <input
                type="text"
                readOnly
                value={`₹${(Number(loadingCharges) || 0).toFixed(2)} INR`}
                className="w-40 h-[24px] px-2 text-right font-mono font-semibold text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
              />
            </div>
          </div>

          {/* Other Charges */}
          <div className="flex items-center justify-end w-full max-w-[480px] gap-1">
            <div className="flex-1 flex items-center justify-end gap-1 pr-2 truncate">
              <label className="text-[var(--sap-text-muted)] font-semibold text-right text-[11.5px] truncate">
                Other Charges
              </label>
              <span
                className={`text-[9.5px] px-1 py-0.2 rounded font-mono font-bold shrink-0 ${
                  getTaxRateFromCode(otherTaxCode) > 0
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
                title={`Other Charges Tax Code: ${otherTaxCode} (${getTaxRateFromCode(otherTaxCode)}%)`}
              >
                {getChargeBadgeText(otherTaxCode)}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('tax')}
                className="text-amber-600 font-extrabold hover:scale-125 cursor-pointer text-xs"
                title="Configure Other Charges Tax Code in Tax Tab"
              >
                ➔
              </button>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* % Input */}
              <div className="flex items-center gap-0.5">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={otherPercent}
                  onChange={(e) => handleOtherPercentChange(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-12 h-[24px] px-1 text-right font-mono font-bold text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                  title="Other Charges Percentage (%) of total amount"
                />
                <span className="text-[var(--sap-text-muted)] text-[10.5px] font-bold">%</span>
              </div>
              {/* ₹ Amount Input */}
              <div className="relative flex items-center">
                <span className="absolute left-1 text-[11px] font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={otherCharges}
                  onChange={(e) => handleOtherAmountChange(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-16 h-[24px] pl-3.5 pr-1 text-right font-mono font-bold text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-bg)] text-[var(--sap-text)] outline-none"
                  title="Other Charges Amount in INR (₹)"
                />
              </div>
              <input
                type="text"
                readOnly
                value={`₹${(Number(otherCharges) || 0).toFixed(2)} INR`}
                className="w-40 h-[24px] px-2 text-right font-mono font-semibold text-[11px] border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
              />
            </div>
          </div>

          {/* Total Product & Available Charges Amount (Replaces Taxable Subtotal) */}
          <div className="flex items-center justify-end w-full max-w-[480px]">
            <label 
              className="flex-1 text-[var(--sap-text-muted)] font-bold pr-3 text-right text-[11px] truncate"
              title={financials.productAndChargesLabel}
            >
              {financials.productAndChargesLabel}
            </label>
            <input
              type="text"
              readOnly
              value={`₹${(financials.totalProductAndCharges !== undefined ? financials.totalProductAndCharges : (financials.taxableSubtotal || 0)).toFixed(2)} INR`}
              className="w-40 h-[24px] px-2 text-right font-mono font-bold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
            />
          </div>

          {/* GST Tax Treatment & Supply Type Badge */}
          <div className="flex items-center justify-between w-full max-w-[480px] px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 rounded border border-slate-300 dark:border-slate-700 text-[11px]">
            <span className="text-[var(--sap-text-muted)] font-bold">GST Supply Type:</span>
            <span className={`font-black flex items-center gap-1 ${
              isInterState ? 'text-blue-700 dark:text-blue-400' : 'text-emerald-700 dark:text-emerald-400'
            }`}>
              <span>{isInterState ? '🌐 INTER-STATE (IGST)' : '🏛️ INTRA-STATE (CGST + SGST)'}</span>
              <span className="text-[10px] font-normal text-slate-500">
                ({hasCustomerGstin ? '🔒 Auto-Applied' : '✍ Manual'})
              </span>
            </span>
          </div>

          {/* Detailed Elaborated Tax Lines: CGST + SGST per active slab or IGST per active slab */}
          {!isInterState ? (
            <>
              {financials.gstSlabs && financials.gstSlabs.length > 0 ? (
                financials.gstSlabs.map(slab => (
                  <React.Fragment key={`slab_intra_${slab.rate}`}>
                    {/* CGST */}
                    <div className="flex items-center justify-end w-full max-w-[480px]">
                      <label className="flex-1 text-[var(--sap-text-muted)] font-semibold pr-3 text-right">
                        Central GST (CGST {slab.halfRate}%)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={`₹${(slab.cgstAmount || 0).toFixed(2)} INR`}
                        className="w-40 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
                      />
                    </div>

                    {/* SGST */}
                    <div className="flex items-center justify-end w-full max-w-[480px]">
                      <label className="flex-1 text-[var(--sap-text-muted)] font-semibold pr-3 text-right">
                        State GST (SGST {slab.halfRate}%)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={`₹${(slab.sgstAmount || 0).toFixed(2)} INR`}
                        className="w-40 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
                      />
                    </div>
                  </React.Fragment>
                ))
              ) : (
                <>
                  {/* Central GST (CGST) */}
                  <div className="flex items-center justify-end w-full max-w-[480px]">
                    <label className="flex-1 text-[var(--sap-text-muted)] font-semibold pr-3 text-right">
                      Central GST (CGST)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`₹${(financials.cgst || 0).toFixed(2)} INR`}
                      className="w-40 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
                    />
                  </div>

                  {/* State GST (SGST) */}
                  <div className="flex items-center justify-end w-full max-w-[480px]">
                    <label className="flex-1 text-[var(--sap-text-muted)] font-semibold pr-3 text-right">
                      State GST (SGST)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`₹${(financials.sgst || 0).toFixed(2)} INR`}
                      className="w-40 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            /* IGST per active slab */
            <>
              {financials.gstSlabs && financials.gstSlabs.length > 0 ? (
                financials.gstSlabs.map(slab => (
                  <div key={`slab_inter_${slab.rate}`} className="flex items-center justify-end w-full max-w-[480px]">
                    <label className="flex-1 text-[var(--sap-text-muted)] font-semibold pr-3 text-right">
                      Integrated GST (IGST {slab.rate}%)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`₹${(slab.igstAmount || 0).toFixed(2)} INR`}
                      className="w-40 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-blue-600 dark:text-blue-400 outline-none"
                    />
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-end w-full max-w-[480px]">
                  <label className="flex-1 text-[var(--sap-text-muted)] font-semibold pr-3 text-right">
                    Integrated GST (IGST)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`₹${(financials.igst || 0).toFixed(2)} INR`}
                    className="w-40 h-[24px] px-2 text-right font-mono font-semibold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-blue-600 dark:text-blue-400 outline-none"
                  />
                </div>
              )}
            </>
          )}

          {/* Total GST Taxes */}
          <div className="flex items-center justify-end w-full max-w-[480px]">
            <label className="flex-1 text-[var(--sap-text-muted)] font-bold pr-3 text-right">Total GST Tax</label>
            <input
              type="text"
              readOnly
              value={`₹${(financials.totalTax || 0).toFixed(2)} INR`}
              className="w-40 h-[24px] px-2 text-right font-mono font-bold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-amber-600 dark:text-amber-400 outline-none"
            />
          </div>

          {/* Round-Off Adjustment (PO Order Round-off Style) */}
          <div className="flex items-center justify-end w-full max-w-[480px] gap-2">
            <label className="flex-1 flex items-center justify-end gap-1.5 text-[var(--sap-text-muted)] font-bold cursor-pointer select-none pr-3">
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
              className="w-40 h-[24px] px-2 text-right font-mono font-bold border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-[var(--sap-text)] outline-none"
            />
          </div>

          {/* Net Grand Total */}
          <div className="flex items-center justify-end w-full max-w-[480px] pt-1">
            <label className="flex-1 text-[var(--sap-text)] font-extrabold pr-3 text-right text-xs">
              Net Grand Total
            </label>
            <input
              type="text"
              readOnly
              value={`₹${financials.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR`}
              className="w-40 h-[26px] px-2 text-right font-mono font-black text-sm border border-[var(--sap-border-inner)] bg-[var(--sap-input-readonly)] text-emerald-700 dark:text-emerald-400 outline-none"
            />
          </div>

          {/* Advance Paid & Balance Due */}
          <div className="flex items-center justify-between w-full max-w-[480px] text-xs pt-1 px-1 text-slate-600 dark:text-slate-400">
            <span>Advance Paid: <strong className="font-mono text-slate-800 dark:text-white">₹{(Number(advancePaid) || 0).toFixed(2)}</strong></span>
            <span>Balance Due: <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">₹{(financials.balanceDue || 0).toFixed(2)}</strong></span>
          </div>

          {/* Amount in Words */}
          <div className="text-[10.5px] text-slate-500 font-semibold italic w-full max-w-[480px] text-right truncate">
            {financials.amountInWords}
          </div>
        </div>
      </div>

      {/* FULL SCREEN BOTTOM ACTIONS BAR (Golden Yellow Add/Update Button, Cancel, PDF Print) */}
      <div className="w-full px-4 py-2.5 bg-[var(--sap-bg-window)] border-t border-[var(--sap-border-inner)] flex flex-wrap items-center justify-between gap-3 shadow-md">
        
        {/* Left Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isDocumentLocked ? (
            <button
              type="button"
              disabled
              className="px-6 h-[28px] bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-xs border border-slate-300 dark:border-slate-700 rounded-xs flex items-center gap-2 cursor-not-allowed shadow-inner"
              title={lockedReason || "This document has already been converted and cannot be changed, edited, or deleted."}
            >
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span>Document Locked (Immutable)</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={createOrderMutation.isPending}
              onClick={handleSaveOrder}
              className="px-8 h-[28px] bg-[var(--sap-btn-gold)] hover:bg-[var(--sap-btn-gold-hover)] text-[var(--sap-btn-gold-text)] font-bold text-xs border border-amber-600 rounded-xs shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {createOrderMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{editOrderId ? 'Updating Document...' : 'Saving Document...'}</span>
                </>
              ) : editOrderId ? (
                <span>Update Document</span>
              ) : orderMode === 'INVOICE' ? (
                <span>Post Tax Invoice (Deducts Stock)</span>
              ) : orderMode === 'STANDARD' ? (
                <span>Save Standard Order</span>
              ) : (
                <span>Create Quotation</span>
              )}
            </button>
          )}

          {/* Workflow Conversion Action (When Viewing/Editing) */}
          {editOrderId && orderMode === 'QUOTATION' && (
            isConvertedQuote ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (convertedChildOrder) {
                      navigate(`/sales/order?id=${convertedChildOrder.id}`);
                    } else {
                      setShowDocFlowModal(true);
                    }
                  }}
                  className="px-3 h-[28px] bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs border border-purple-700 rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Quotation has been converted! Click to open Sales Order."
                >
                  <CheckCheck className="w-3.5 h-3.5 text-purple-200" />
                  <span>View Converted Order (#{convertedChildOrder?.docNo || convertedChildOrder?.orderNumber || 'SO'})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDocFlowModal(true)}
                  className="px-3 h-[28px] bg-slate-800 hover:bg-slate-700 text-purple-300 font-bold text-xs border border-purple-600 rounded-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                  title="View complete SAP Document Flow and history"
                >
                  <GitFork className="w-3.5 h-3.5" />
                  <span>Document Flow</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConvertToOrderFromStudio}
                className="px-4 h-[28px] bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs border border-blue-700 rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                title="Convert this quotation into a Standard Sales Order"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-200" />
                <span>Convert to Standard Order</span>
              </button>
            )
          )}

          {editOrderId && orderMode === 'STANDARD' && (
            isInvoicedOrder ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (invoiceChildOrder) {
                      navigate(`/sales/order?id=${invoiceChildOrder.id}`);
                    } else {
                      setShowDocFlowModal(true);
                    }
                  }}
                  className="px-3 h-[28px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs border border-emerald-700 rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Sales Order has been invoiced! Click to open Tax Invoice."
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />
                  <span>View Converted Invoice (#{invoiceChildOrder?.docNo || invoiceChildOrder?.orderNumber || 'INV'})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDocFlowModal(true)}
                  className="px-3 h-[28px] bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs border border-emerald-600 rounded-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                  title="View complete SAP Document Flow and history"
                >
                  <GitFork className="w-3.5 h-3.5" />
                  <span>Document Flow</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConvertToInvoiceFromStudio}
                className="px-4 h-[28px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs border border-emerald-700 rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                title="Convert this Standard Order into a Tax Invoice"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-200" />
                <span>Convert to Tax Invoice</span>
              </button>
            )
          )}

          <button
            type="button"
            onClick={handleResetForm}
            className="px-5 h-[28px] bg-[var(--sap-btn-sec)] hover:bg-[var(--sap-btn-sec-hover)] text-[var(--sap-text)] font-bold text-xs border border-[var(--sap-border-inner)] rounded-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {editOrderId && (
            <button
              type="button"
              onClick={() => setShowDocFlowModal(true)}
              className="px-3 h-[28px] bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs border border-slate-600 rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 ml-1 shadow-xs"
              title="View Complete SAP Document Flow & Lifecycle History"
            >
              <GitFork className="w-3.5 h-3.5 text-indigo-300" />
              <span>Document Flow</span>
            </button>
          )}




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
          <span>{getIndianStateName(supplierStateCode)} ({supplierStateCode}) • {isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}</span>
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
              <div className="flex items-center gap-3 font-bold text-sm">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span>Item Catalog Browser</span>
                </div>
                <div className="flex items-center bg-slate-900 rounded p-0.5 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setCatalogScope('PRODUCTS')}
                    className={`px-2.5 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                      catalogScope === 'PRODUCTS'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Finished Products ({products.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogScope('RAW_MATERIALS')}
                    className={`px-2.5 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                      catalogScope === 'RAW_MATERIALS'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Raw Materials & Packing ({rawMaterials.length})
                  </button>
                </div>
                <span className="text-xs font-normal text-slate-300 opacity-80 pl-2 border-l border-slate-600 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Live Stock</span>
                  {lastStockSyncTime && (
                    <span className="text-emerald-300 font-mono text-[11px]">(Synced: {lastStockSyncTime})</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSyncingStock}
                  onClick={handleSyncStock}
                  className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-amber-300 font-bold text-xs rounded-xs flex items-center gap-1.5 cursor-pointer border border-slate-600 mr-1"
                  title="Synchronize Live Warehouse Inventory"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingStock ? 'animate-spin text-amber-400' : 'text-amber-300'}`} />
                  <span>{isSyncingStock ? 'Syncing...' : 'Sync Stock'}</span>
                </button>
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
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchCatalogQuery}
                  onChange={(e) => setSearchCatalogQuery(e.target.value)}
                  placeholder={catalogScope === 'PRODUCTS' 
                    ? "Search System Code, Product Name, Category, Subcategory (e.g. K123, kulfistick, kulfi almond)..."
                    : "Search Raw Material Code, Name, Category (e.g. RM-00008, Thermocol Box, Dry Ice)..."}
                  className="w-full pl-9 pr-8 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xs text-xs font-semibold outline-none focus:border-amber-500"
                />
                {searchCatalogQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchCatalogQuery('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {catalogScope === 'PRODUCTS' && (
                /* 2-Tier Filtering: Base Category -> Subcategory Pills */
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
              )}
            </div>

            {/* Catalog Content Area */}
            <div className="flex-1 overflow-y-auto p-3">
              {catalogScope === 'PRODUCTS' ? (
                catalogViewMode === 'table' ? (
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

                      {filteredCatalogItems.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400">
                            <div className="font-bold text-sm text-slate-600 dark:text-slate-300">No products found</div>
                            <div className="text-xs text-slate-400 mt-1">
                              No product matching "{searchCatalogQuery}" {selectedBaseCategory !== 'All' ? `in ${selectedBaseCategory}` : ''}
                            </div>
                            {(selectedBaseCategory !== 'All' || selectedSubcategory !== 'All') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBaseCategory('All');
                                  setSelectedSubcategory('All');
                                }}
                                className="mt-3 px-3.5 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-xs text-xs hover:bg-amber-400 cursor-pointer shadow-xs inline-flex items-center gap-1"
                              >
                                <span>Search across All Categories</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
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

                    {filteredCatalogItems.length === 0 && (
                      <div className="col-span-full py-12 text-center text-slate-400">
                        <div className="font-bold text-sm text-slate-600 dark:text-slate-300">No products found</div>
                        <div className="text-xs text-slate-400 mt-1">
                          No product matching "{searchCatalogQuery}" {selectedBaseCategory !== 'All' ? `in ${selectedBaseCategory}` : ''}
                        </div>
                        {(selectedBaseCategory !== 'All' || selectedSubcategory !== 'All') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBaseCategory('All');
                              setSelectedSubcategory('All');
                            }}
                            className="mt-3 px-3.5 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-xs text-xs hover:bg-amber-400 cursor-pointer shadow-xs inline-flex items-center gap-1"
                          >
                            <span>Search across All Categories</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* RAW MATERIALS SCOPE */
                catalogViewMode === 'table' ? (
                  <table className="w-full border-collapse text-xs select-text">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 font-bold sticky top-0 z-10 select-none">
                        <th className="py-2 px-2 text-left w-28">RM Code</th>
                        <th className="py-2 px-2 text-left">Raw Material Name</th>
                        <th className="py-2 px-2 text-left w-40">Category</th>
                        <th className="py-2 px-2 text-center w-24">UOM</th>
                        <th className="py-2 px-2 text-right w-32">Unit Rate (INR)</th>
                        <th className="py-2 px-2 text-center w-28">Live Stock</th>
                        <th className="py-2 px-2 text-center w-48">Add to Document</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredCatalogRawMaterials.map(rm => {
                        const price = Number(rm.ratePerUnit || 0);
                        const liveStock = Number(rm.currentStock || 0);
                        const gstRate = 18;

                        return (
                          <tr
                            key={rm.id}
                            className="hover:bg-amber-50 dark:hover:bg-slate-800/60 transition-colors"
                          >
                            <td className="py-2 px-2 font-mono font-bold text-amber-700 dark:text-amber-400">
                              {rm.code}
                            </td>
                            <td className="py-2 px-2 font-bold text-slate-900 dark:text-white">
                              {rm.printName || rm.name}
                            </td>
                            <td className="py-2 px-2 text-slate-600 dark:text-slate-300 font-medium">
                              {rm.category?.name || rm.category || 'Raw Material'}
                            </td>
                            <td className="py-2 px-2 text-center font-semibold text-slate-700 dark:text-slate-300">
                              {rm.unitId || 'kg'}
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
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleAddRawMaterialFromCatalog(rm, false);
                                    setShowCatalogModal(false);
                                  }}
                                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10.5px] rounded-xs shadow-xs flex items-center gap-1 cursor-pointer"
                                  title="Add as resale raw material item"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Resale</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleAddRawMaterialFromCatalog(rm, true);
                                    setShowCatalogModal(false);
                                  }}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10.5px] rounded-xs shadow-xs flex items-center gap-1 cursor-pointer"
                                  title="Add as packing charge line"
                                >
                                  <span>📦 Packing</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredCatalogRawMaterials.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <div className="font-bold text-sm text-slate-600 dark:text-slate-300">No raw materials found</div>
                            <div className="text-xs text-slate-400 mt-1">
                              No raw material matching "{searchCatalogQuery}"
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredCatalogRawMaterials.map(rm => {
                      const price = Number(rm.ratePerUnit || 0);
                      const liveStock = Number(rm.currentStock || 0);
                      const gstRate = 18;

                      return (
                        <div
                          key={rm.id}
                          className="p-3 border border-slate-200 dark:border-slate-800 rounded-xs bg-white dark:bg-slate-900 hover:border-amber-400 dark:hover:border-amber-500 transition-all flex flex-col justify-between shadow-xs group"
                        >
                          <div>
                            <div className="flex items-center justify-between text-[10.5px] mb-1.5">
                              <span className="font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-xs border border-amber-200 dark:border-amber-900/60">
                                {rm.code}
                              </span>
                              <span className={`px-2 py-0.5 rounded-xs font-mono font-bold flex items-center gap-1 ${
                                liveStock > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600 border border-slate-300'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${liveStock > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                <span>Stock: {liveStock}</span>
                              </span>
                            </div>
                            <div className="font-bold text-slate-900 dark:text-white text-xs line-clamp-1 group-hover:text-amber-600 transition-colors">
                              {rm.printName || rm.name}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                              <div><span className="font-semibold text-slate-600 dark:text-slate-400">Category:</span> {rm.category?.name || rm.category || 'Raw Material'}</div>
                              <div><span className="font-semibold text-slate-600 dark:text-slate-400">UOM:</span> {rm.unitId || 'kg'}</div>
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
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  handleAddRawMaterialFromCatalog(rm, false);
                                  setShowCatalogModal(false);
                                }}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10.5px] rounded-xs shadow-xs flex items-center gap-0.5 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Resale</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleAddRawMaterialFromCatalog(rm, true);
                                  setShowCatalogModal(false);
                                }}
                                className="px-1.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10.5px] rounded-xs shadow-xs flex items-center gap-0.5 cursor-pointer"
                              >
                                <span>📦 Pack</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-slate-600 dark:text-slate-300 text-xs">
              <span className="font-semibold">
                Showing {catalogScope === 'PRODUCTS' ? filteredCatalogItems.length : filteredCatalogRawMaterials.length} of {catalogScope === 'PRODUCTS' ? products.length : rawMaterials.length} Items
              </span>
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

      {/* FULL PREVIEW MODAL FOR ATTACHMENT IMAGES & DOCUMENTS */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative max-w-4xl w-full max-h-[90vh] bg-white dark:bg-slate-900 rounded-sm overflow-hidden p-3 flex flex-col items-center shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewModalUrl(null)}
              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black text-white rounded-full z-10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {previewModalUrl.toLowerCase().includes('.pdf') ? (
              <iframe
                src={previewModalUrl}
                title="Document Attachment Preview"
                className="w-full h-[75vh] border border-slate-200 dark:border-slate-800 rounded-xs"
              />
            ) : (
              <img
                src={previewModalUrl}
                alt="Attachment Full Preview"
                className="max-h-[75vh] max-w-full object-contain rounded-xs"
              />
            )}
            <div className="pt-3 flex items-center gap-3 w-full justify-center border-t border-slate-200 dark:border-slate-800 mt-2">
              <a
                href={previewModalUrl}
                download="order_attachment"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xs flex items-center gap-1.5 text-xs shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download / Open In New Tab</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewModalUrl(null)}
                className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold rounded-xs text-xs"
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

      {/* RAW MATERIAL BATCH / LOT ALLOCATION MODAL */}
      {isRMLotModalOpen && activeRMLotLine && (
        <RMLotAllocationModal
          isOpen={isRMLotModalOpen}
          onClose={() => {
            setIsRMLotModalOpen(false);
            setActiveRMLotLine(null);
          }}
          item={activeRMLotLine}
          initialAllocations={activeRMLotLine.batchAllocations || []}
          onApplyAllocations={handleApplyRMLotAllocations}
          readOnly={isDocumentLocked}
        />
      )}

      {/* SAP DOCUMENT FLOW & LIFECYCLE HISTORY MODAL */}
      <DocumentFlowModal
        isOpen={showDocFlowModal}
        onClose={() => setShowDocFlowModal(false)}
        orderId={editOrderId}
        initialOrder={loadedOrderData}
        onNavigateOrder={(targetId) => navigate(`/sales/order?id=${targetId}`)}
      />
    </div>
  );
}
