import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '@/lib/axios';
import { 
  FileText, Search, RefreshCw, AlertTriangle, ShieldAlert, Award, 
  Clock, ArrowRight, X, ChevronLeft, Eye, Printer, Sparkles, Loader2, 
  Download, ShoppingBag, CheckCircle2, User, CreditCard, Banknote, Layers, Plus,
  MessageSquare, Mail, Play, Building2, Send, Share2,
  ArrowUp, ArrowDown, ArrowUpDown, Filter, Save, Camera, ImageIcon, Paperclip,
  Package, Truck, Check, ExternalLink, Maximize2, Trash2, Calendar, Phone,
  FileCheck, ShieldCheck, MapPin, Edit3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Swal from 'sweetalert2';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { Pagination } from '@/components/ui/Pagination';
import DashboardBackButton from '@/components/ui/DashboardBackButton';
import useAuthStore from '@/app/store/authStore';
import useCompanyStore from '@/app/store/companyStore';
import { generateA4TaxInvoice, generateThermalReceipt } from '@/utils/salesPdfGenerator';
import { numberToWordsINR, getIndianStates } from '@/utils/gstEngine';

// Official WhatsApp SVG Logo Icon
const WhatsAppIcon = ({ className = "w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 24 24" className={`${className} fill-current`} xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

export default function SalesListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderIdParam = searchParams.get('id');
  const user = useAuthStore(s => s.user);
  const isReadOnly = user?.role === 'SUPERVISOR';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('date_desc');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Dynamic settings & Tab view
  const [companySettings, setCompanySettings] = useState(null);
  const [layoutMode, setLayoutMode] = useState('A4'); // A4 or POS
  const [activePdfUrl, setActivePdfUrl] = useState(null);
  const [activeStudioTab, setActiveStudioTab] = useState('contents'); // 'contents' | 'logistics' | 'accounting' | 'tax' | 'attachments' | 'pdf'

  // Photo modal & Attachment upload state
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Editing State for Detailed Inspector View
  const [isEditing, setIsEditing] = useState(false);

  // Editable Form fields for the Detailed View
  const [editForm, setEditForm] = useState({
    shipToAddress: '',
    billToAddress: '',
    shippingMethod: 'Road Transport',
    transporterName: '',
    vehicleNo: '',
    lrNo: '',
    ewayBillNo: '',
    ewayBillDate: '',
    paymentTerms: 'Not Paid',
    paymentStatus: 'PAID',
    paymentMethod: 'Bank Transfer / NEFT',
    amountPaid: 0,
    placeOfSupply: '33',
    taxRegNo: '',
    internalNote: '',
    remarks: '',
    salesEmployee: '-No Sales Employee-',
    owner: 'Mathan'
  });

  const resetEditForm = (order) => {
    if (!order) return;
    setEditForm({
      shipToAddress: order.deliveryAddress || '',
      billToAddress: order.billToAddress || order.customer?.billingAddress || order.deliveryAddress || '',
      shippingMethod: order.shippingMethod || 'Road Transport',
      transporterName: order.transporterName || '',
      vehicleNo: order.vehicleNo || '',
      lrNo: order.lrNo || '',
      ewayBillNo: order.ewayBillNo || '',
      ewayBillDate: order.ewayBillDate ? order.ewayBillDate.split('T')[0] : '',
      paymentTerms: order.paymentTerms || (order.type === 'POS' ? 'Immediate Cash' : 'Not Paid'),
      paymentStatus: order.paymentStatus || (order.type === 'POS' ? 'PAID' : 'PENDING'),
      paymentMethod: order.paymentMode || (order.type === 'POS' ? 'Cash' : 'Bank Transfer / NEFT'),
      amountPaid: Number(order.amountPaid || (order.type === 'POS' ? order.grandTotal : 0)),
      placeOfSupply: order.placeOfSupply || '33',
      taxRegNo: order.taxRegNo || order.customer?.gstin || '',
      internalNote: order.internalNote || '',
      remarks: order.quotationNote || '',
      salesEmployee: order.salesEmployee || '-No Sales Employee-',
      owner: order.creator?.name || order.cashierName || 'Mathan'
    });
  };

  // Pagination State - defaults to 'ALL' to display fully without overflow
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState('ALL');

  // Live Company & Tax Settings from store
  const storeCompany = useCompanyStore((s) => s.company);
  const fetchCompany = useCompanyStore((s) => s.fetchCompany);
  const compName = storeCompany?.companyName || 'Company';
  const compAddr = storeCompany?.companyAddress || 'Factory / Registered Office Address';
  const compGstin = storeCompany?.companyGstin || '';

  const fetchSales = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/orders');
      const list = res.data || [];
      setOrders(list.filter(o => o.type === 'Invoice' || o.type === 'Sales Order' || o.type === 'POS' || o.type === 'Quotation'));
    } catch (e) {
      console.error('Failed to fetch sales orders', e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Automatic live sync every 10 seconds
  useEffect(() => {
    fetchSales();
    const interval = setInterval(() => {
      fetchSales(true);
    }, 10000);

    api.get('/setup/tax').then(res => {
      if (res.data) setCompanySettings(res.data);
    }).catch(err => console.warn('Could not load setup tax', err));

    return () => clearInterval(interval);
  }, []);

  // Fetch full details when an order ID is selected in the URL
  useEffect(() => {
    const fetchOrderDetail = async () => {
      if (!orderIdParam) {
        setSelectedOrder(null);
        return;
      }
      setLoadingDetail(true);
      try {
        const res = await api.get(`/orders/${orderIdParam}`);
        setSelectedOrder(res.data);
      } catch (err) {
        console.error('Failed to load order details', err);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchOrderDetail();
  }, [orderIdParam]);

  // Sync edit form and attachments whenever selectedOrder changes
  useEffect(() => {
    if (selectedOrder) {
      resetEditForm(selectedOrder);
      setIsEditing(false);

      // Parse attachments
      let initialAttachments = [];
      if (selectedOrder.attachmentUrl) {
        initialAttachments.push({
          id: 'att_primary',
          url: selectedOrder.attachmentUrl,
          filename: selectedOrder.attachmentUrl.split('/').pop() || 'Invoice_Doc.png',
          uploadedAt: new Date(selectedOrder.createdAt).toLocaleDateString('en-GB'),
          fileSize: '520 KB',
          orderId: selectedOrder.docNo || selectedOrder.referenceNo
        });
      }
      if (selectedOrder.internalNote && selectedOrder.internalNote.includes('[[ATTACHMENT:')) {
        try {
          const match = selectedOrder.internalNote.match(/\[\[ATTACHMENT:(.*?)\]\]/);
          if (match && match[1]) {
            const parsed = JSON.parse(match[1]);
            if (Array.isArray(parsed)) {
              initialAttachments = [...initialAttachments, ...parsed];
            }
          }
        } catch (e) {
          // ignore parse error
        }
      }
      setAttachments(initialAttachments);
    }
  }, [selectedOrder]);

  // Handle PDF Generation
  useEffect(() => {
    if (selectedOrder) {
      if (selectedOrder.type === 'POS' && layoutMode !== 'POS') {
        setLayoutMode('POS');
      } else if (selectedOrder.type !== 'POS' && layoutMode === 'POS') {
        setLayoutMode('A4');
      }
    }
  }, [selectedOrder?.id]);

  useEffect(() => {
    if (selectedOrder) {
      const activeSettings = companySettings || storeCompany;
      let blob;
      try {
        blob = layoutMode === 'A4'
          ? generateA4TaxInvoice(selectedOrder, activeSettings)
          : generateThermalReceipt(selectedOrder, activeSettings);
      } catch (err) {
        console.warn('Advanced PDF generator error, falling back to legacy compiler:', err);
        blob = layoutMode === 'A4' 
          ? compileInvoiceA4PDF(selectedOrder, activeSettings) 
          : compileThermalBillPDF(selectedOrder, activeSettings);
      }
      
      if (activePdfUrl) {
        URL.revokeObjectURL(activePdfUrl);
      }
      const url = URL.createObjectURL(blob);
      setActivePdfUrl(url);
    }
  }, [selectedOrder, layoutMode, companySettings]);

  // Reset page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, paymentStatusFilter, sortBy]);

  // Tab counts for clean commercial transaction models
  const tabCounts = useMemo(() => {
    const all = orders.length;
    const pos = orders.filter(o => o.type === 'POS').length;
    const invoices = orders.filter(o => o.type === 'Invoice').length;
    const salesOrders = orders.filter(o => o.type === 'Sales Order' && o.status !== 'Waiting for Production' && o.orderMode !== 'NEED_PLANNING').length;
    const needProduction = orders.filter(o => o.status === 'Waiting for Production' || o.orderMode === 'NEED_PLANNING').length;
    const quotations = orders.filter(o => o.type === 'Quotation').length;
    return { all, pos, invoices, salesOrders, needProduction, quotations };
  }, [orders]);

  // Filtered orders list based on selected commercial tab
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (typeFilter === 'POS') {
        if (order.type !== 'POS') return false;
      } else if (typeFilter === 'Invoice') {
        if (order.type !== 'Invoice') return false;
      } else if (typeFilter === 'Sales Order') {
        if (order.type !== 'Sales Order' || order.status === 'Waiting for Production' || order.orderMode === 'NEED_PLANNING') return false;
      } else if (typeFilter === 'Waiting for Production') {
        if (order.status !== 'Waiting for Production' && order.orderMode !== 'NEED_PLANNING') return false;
      } else if (typeFilter === 'Quotation') {
        if (order.type !== 'Quotation') return false;
      } else if (typeFilter !== 'ALL') {
        if (order.type !== typeFilter) return false;
      }

      if (paymentStatusFilter !== 'ALL' && (order.paymentStatus || 'PAID') !== paymentStatusFilter) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      const refMatch = (order.referenceNo || '').toLowerCase().includes(q) || (order.docNo || '').toLowerCase().includes(q);
      const nameMatch = (order.customer?.name || order.customerName || '').toLowerCase().includes(q);
      const phoneMatch = (order.customer?.phone || order.customerPhone || '').toLowerCase().includes(q);
      const gstinMatch = ((order.customer?.gstin || order.taxRegNo) || '').toLowerCase().includes(q);
      const counterMatch = (order.counterId || '').toLowerCase().includes(q);
      const cashierMatch = (order.cashierName || '').toLowerCase().includes(q);
      const statusMatch = (order.status || '').toLowerCase().includes(q);
      const paymentMatch = (order.paymentStatus || '').toLowerCase().includes(q) || (order.paymentTerms || '').toLowerCase().includes(q);
      const typeMatch = (order.type || '').toLowerCase().includes(q);
      const totalMatch = String(order.grandTotal || order.totalSubtotal || '').includes(q);
      return refMatch || nameMatch || phoneMatch || gstinMatch || counterMatch || cashierMatch || statusMatch || paymentMatch || typeMatch || totalMatch;
    }).sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'date_asc') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'doc_asc') return (a.docNo || a.referenceNo || '').localeCompare(b.docNo || b.referenceNo || '', undefined, { numeric: true });
      if (sortBy === 'doc_desc') return (b.docNo || b.referenceNo || '').localeCompare(a.docNo || a.referenceNo || '', undefined, { numeric: true });
      if (sortBy === 'party_asc') return (a.customerName || a.customer?.name || '').localeCompare(b.customerName || b.customer?.name || '');
      if (sortBy === 'party_desc') return (b.customerName || b.customer?.name || '').localeCompare(a.customerName || a.customer?.name || '');
      if (sortBy === 'amount_desc') return Number(b.grandTotal || b.totalSubtotal || 0) - Number(a.grandTotal || a.totalSubtotal || 0);
      if (sortBy === 'amount_asc') return Number(a.grandTotal || a.totalSubtotal || 0) - Number(b.grandTotal || b.totalSubtotal || 0);
      if (sortBy === 'payment_asc') return (a.paymentStatus || '').localeCompare(b.paymentStatus || '');
      return 0;
    });
  }, [orders, typeFilter, paymentStatusFilter, searchTerm, sortBy]);

  const handleToggleSort = (field) => {
    setSortBy(prev => {
      if (field === 'date') return prev === 'date_desc' ? 'date_asc' : 'date_desc';
      if (field === 'doc') return prev === 'doc_asc' ? 'doc_desc' : 'doc_asc';
      if (field === 'party') return prev === 'party_asc' ? 'party_desc' : 'party_asc';
      if (field === 'amount') return prev === 'amount_desc' ? 'amount_asc' : 'amount_desc';
      if (field === 'payment') return prev === 'payment_asc' ? 'date_desc' : 'payment_asc';
      return 'date_desc';
    });
  };

  const getSortIcon = (field) => {
    if (sortBy === `${field}_asc`) return <ArrowUp className="w-3.5 h-3.5 text-indigo-600 inline ml-1" />;
    if (sortBy === `${field}_desc`) return <ArrowDown className="w-3.5 h-3.5 text-indigo-600 inline ml-1" />;
    return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60 inline ml-1" />;
  };

  // Legacy PDF compilers (fallback)
  const compileInvoiceA4PDF = (order, settings) => {
    const doc = new jsPDF();
    const activeCompany = settings || storeCompany;
    const companyName = activeCompany?.companyName || 'Company';
    const companyAddress = activeCompany?.companyAddress || 'Factory / Registered Office Address';
    const companyGstin = activeCompany?.companyGstin || '';
    const companyMobile = activeCompany?.companyMobile || '';

    const customerGstin = order.customer?.gstin || order.taxRegNo || '';

    doc.setFillColor(30, 27, 75);
    doc.rect(0, 0, 210, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(30, 27, 75);
    doc.text('TAX INVOICE', 14, 22);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(companyName.toUpperCase(), 14, 28);
    doc.text(`GSTIN: ${companyGstin} | Mobile: ${companyMobile}`, 14, 33);
    doc.text(`Doc Ref: ${order.docNo || order.referenceNo} | Date: ${new Date(order.createdAt).toLocaleDateString('en-GB')}`, 14, 38);
    doc.text(`Billed To: ${order.customer?.name || order.customerName || 'Walk-in'} (GSTIN: ${customerGstin || 'URP'})`, 14, 43);

    let curY = 52;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, curY, 182, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Item Description', 16, curY + 5);
    doc.text('Qty', 110, curY + 5, { align: 'right' });
    doc.text('Price', 140, curY + 5, { align: 'right' });
    doc.text('Total', 190, curY + 5, { align: 'right' });

    curY += 7;
    doc.setFont('helvetica', 'normal');
    (order.items || []).forEach((item, idx) => {
      curY += 6;
      doc.text(String(item.product?.name || item.productName || 'Finished Item').substring(0, 35), 16, curY);
      doc.text(String(item.quantity || 0), 110, curY, { align: 'right' });
      doc.text(`Rs.${Number(item.unitPrice || 0).toFixed(2)}`, 140, curY, { align: 'right' });
      doc.text(`Rs.${Number(item.subtotal || (item.quantity * item.unitPrice) || 0).toFixed(2)}`, 190, curY, { align: 'right' });
    });

    curY += 10;
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: Rs.${Number(order.grandTotal || 0).toFixed(2)}`, 190, curY, { align: 'right' });

    return doc.output('blob');
  };

  const compileThermalBillPDF = (order, settings) => {
    const doc = new jsPDF({ unit: 'mm', format: [80, 160] });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('RETAIL TAX INVOICE', 40, 8, { align: 'center' });
    doc.setFontSize(8);
    doc.text(compName.toUpperCase().substring(0, 30), 40, 13, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text(`Bill No: ${order.docNo || order.referenceNo} | ${new Date(order.createdAt).toLocaleDateString('en-GB')}`, 40, 18, { align: 'center' });
    doc.text(`Customer: ${(order.customerName || order.customer?.name || 'Walk-in').substring(0, 25)}`, 40, 22, { align: 'center' });

    let y = 30;
    (order.items || []).forEach(item => {
      doc.text(`${(item.productName || item.product?.name || 'Product').substring(0, 18)} x ${item.quantity}`, 5, y);
      doc.text(`Rs.${Number(item.subtotal || 0).toFixed(2)}`, 75, y, { align: 'right' });
      y += 5;
    });

    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: Rs.${Number(order.grandTotal || 0).toFixed(2)}`, 75, y, { align: 'right' });

    return doc.output('blob');
  };

  const handleDownloadActivePdf = () => {
    if (!activePdfUrl || !selectedOrder) return;
    const a = document.createElement('a');
    a.href = activePdfUrl;
    a.download = `${layoutMode === 'A4' ? 'TAX-INVOICE' : 'POS-RECEIPT'}-${selectedOrder.docNo || selectedOrder.referenceNo}.pdf`;
    a.click();
  };

  const handlePrintActivePdf = () => {
    const iframe = document.getElementById('sales-detail-pdf-frame');
    if (iframe) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  // WhatsApp 1-Click Direct Web Dispatch (with Automatic Bill PDF Generation, Download & Link)
  const handleShareWhatsApp = async (order) => {
    const rawPhone = order.customerPhone || order.customer?.phone;
    if (!rawPhone) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Phone Number',
        text: 'This customer has no phone number recorded.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }
    
    let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    const docNo = order.docNo || order.referenceNo || 'SO-000000';
    const grandTotal = Number(order.grandTotal || order.totalSubtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const dateStr = new Date(order.createdAt).toLocaleDateString('en-GB');
    const custName = order.customerName || order.customer?.name || 'Valued Client';
    const activeSettings = companySettings || storeCompany;
    const company = activeSettings?.companyName || 'ANTIGRAVITY DAIRY & FOODS PRIVATE LIMITED';

    // 1. Fetch full order if items are missing or empty
    let fullOrder = order;
    if (!order.items || order.items.length === 0) {
      try {
        const res = await api.get(`/orders/${order.id}`);
        if (res.data) fullOrder = { ...order, ...res.data };
      } catch (e) {
        console.warn('Could not fetch full order details, using summary:', e);
      }
    }

    // 2. Generate and download statutory Bill PDF directly to device
    const safeDocNo = docNo.replace(/[^a-zA-Z0-9_-]/g, '_');
    const pdfFilename = `Tax_Invoice_${safeDocNo}.pdf`;
    
    try {
      let pdfBlob;
      try {
        pdfBlob = (fullOrder.type === 'POS' && layoutMode === 'POS')
          ? generateThermalReceipt(fullOrder, activeSettings)
          : generateA4TaxInvoice(fullOrder, activeSettings);
      } catch (pdfErr) {
        console.warn('Advanced PDF generator error, falling back:', pdfErr);
        pdfBlob = compileInvoiceA4PDF(fullOrder, activeSettings);
      }

      if (pdfBlob) {
        const downloadUrl = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = pdfFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
      }
    } catch (err) {
      console.error('Failed to trigger bill PDF download:', err);
    }

    // 3. Prepare direct downloadable bill PDF link for WhatsApp recipient
    const apiBase = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:5000/api' : `${window.location.origin}/api`);
    const baseUrl = apiBase.startsWith('http') ? apiBase : `${window.location.origin}${apiBase}`;
    const publicPdfUrl = `${baseUrl}/public/orders/${order.id}/pdf`;

    // 4. Construct WhatsApp Message with official format and bill PDF link
    const text = `🧾 *${order.type === 'Quotation' ? 'PROFORMA QUOTATION' : 'TAX INVOICE'}*
🏢 *${company}*
━━━━━━━━━━━━━━━━━━
📄 *Doc No:* ${docNo}
📅 *Date:* ${dateStr}
👤 *Client:* ${custName}
💰 *Total Amount:* ₹${grandTotal}
💳 *Payment:* ${order.paymentTerms || 'Cash'} [${order.paymentStatus || 'PAID'}]
📦 *Status:* ${order.status || 'Confirmed'}

📥 *Download / View Bill PDF:*
${publicPdfUrl}

Thank you for choosing ${company}!`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');

    // 5. Notify user with helpful feedback
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
      confirmButtonColor: '#4f46e5',
      timer: 5000,
      timerProgressBar: true
    });
  };

  // Resend Invoice via Backend (Email)
  const handleResendEmail = async (order) => {
    const defaultEmail = order.customer?.email || 'mathansethupathy@gmail.com';
    const customerName = order.customer?.name || order.customerName || 'Mathan C';
    const docNo = order.docNo || order.referenceNo || 'SO-100100001';
    const grandTotal = Number(order.grandTotal || 0).toFixed(2);

    const confirm = await Swal.fire({
      title: 'Dispatch Invoice Document?',
      width: '520px',
      html: `
        <div class="text-left text-xs text-slate-600 dark:text-slate-300 space-y-3 pt-2">
          <div class="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
            <div class="flex justify-between items-center mb-1">
              <span class="font-bold text-indigo-950 dark:text-indigo-200 text-sm">Invoice #${docNo}</span>
              <span class="font-black text-indigo-600 dark:text-indigo-400">₹${grandTotal}</span>
            </div>
            <div>Customer: <strong>${customerName}</strong></div>
          </div>
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1">
              Dispatch statutory PDF invoice to:
            </label>
            <input id="swal-dispatch-email" type="email" value="${defaultEmail}" 
              class="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white font-semibold"
              placeholder="e.g. mathansethupathy@gmail.com" />
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '⚡ Yes, Dispatch Now',
      confirmButtonColor: '#4f46e5',
      cancelButtonText: 'Cancel',
      focusConfirm: false,
      preConfirm: () => {
        const input = document.getElementById('swal-dispatch-email');
        const emailVal = input ? input.value.trim() : '';
        if (!emailVal || !emailVal.includes('@')) {
          Swal.showValidationMessage('Please enter a valid recipient email');
          return false;
        }
        return emailVal;
      }
    });

    if (!confirm.isConfirmed || !confirm.value) return;

    try {
      Swal.fire({
        title: 'Dispatching Invoice Document...',
        text: 'Generating PDF vector and emailing...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      await api.post(`/orders/${order.id}/resend`, { targetEmail: confirm.value });

      Swal.fire({
        icon: 'success',
        title: 'Invoice Dispatched!',
        text: `Sent to ${confirm.value}`,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Dispatch Failed',
        text: err?.response?.data?.error || err.message,
        confirmButtonColor: '#4f46e5'
      });
    }
  };

  // Transition Order to 'In Production'
  const handleStartProduction = async (order) => {
    const confirm = await Swal.fire({
      title: 'Start Production?',
      html: `<div class="text-xs text-slate-500">
        Move order <strong class="text-slate-800 dark:text-slate-200">${order.docNo || order.referenceNo}</strong> into manufacturing execution stage.
      </div>`,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Start Production',
      confirmButtonColor: '#f59e0b'
    });

    if (!confirm.isConfirmed) return;

    try {
      await api.post(`/orders/${order.id}/start-production`);
      Swal.fire({
        icon: 'success',
        title: 'Order In Production',
        text: `Order ${order.docNo || order.referenceNo} is now queued for manufacturing.`,
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      fetchSales();
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(prev => ({ ...prev, status: 'In Production' }));
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Action Failed',
        text: err?.response?.data?.error || err.message,
        confirmButtonColor: '#4f46e5'
      });
    }
  };

  // Convert Quotation to Confirmed Sales Order
  const handleConvertToOrder = async (order) => {
    const confirm = await Swal.fire({
      title: 'Convert to Sales Order?',
      html: `<div class="text-xs text-slate-500">
        Confirm Quotation <strong class="text-slate-800 dark:text-slate-200">${order.docNo || order.referenceNo}</strong> into a firm Sales Order for production.
      </div>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Convert to Order',
      confirmButtonColor: '#2563eb'
    });

    if (!confirm.isConfirmed) return;

    try {
      await api.post(`/orders/${order.id}/convert-to-order`);
      Swal.fire({
        icon: 'success',
        title: 'Order Confirmed',
        text: 'Quotation has been successfully converted to a Sales Order.',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      fetchSales();
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(prev => ({ ...prev, type: 'Sales Order', status: 'Confirmed' }));
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Conversion Failed',
        text: err?.response?.data?.error || err.message,
        confirmButtonColor: '#4f46e5'
      });
    }
  };

  // Save updates made to the selected order in the Detailed Studio
  const handleSaveOrderUpdates = async () => {
    if (!selectedOrder) return;
    setIsSaving(true);
    try {
      const payload = {
        deliveryAddress: editForm.shipToAddress,
        transporterName: editForm.transporterName,
        vehicleNo: editForm.vehicleNo,
        lrNo: editForm.lrNo,
        ewayBillNo: editForm.ewayBillNo,
        ewayBillDate: editForm.ewayBillDate || null,
        paymentTerms: editForm.paymentTerms,
        paymentStatus: editForm.paymentStatus,
        amountPaid: Number(editForm.amountPaid || 0),
        placeOfSupply: editForm.placeOfSupply,
        taxRegNo: editForm.taxRegNo,
        internalNote: editForm.internalNote,
        quotationNote: editForm.remarks
      };

      const res = await api.patch(`/orders/${selectedOrder.id}/update-details`, payload);
      setSelectedOrder(prev => ({ ...prev, ...res.data }));
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, ...res.data } : o));
      setIsEditing(false);

      Swal.fire({
        icon: 'success',
        title: 'Order Updated Successfully',
        text: `Order #${selectedOrder.docNo || selectedOrder.referenceNo} has been saved.`,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (err) {
      console.error('Failed to update order', err);
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: err?.response?.data?.error || err.message,
        confirmButtonColor: '#4f46e5'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Upload proof photo / doc attachment directly to server directory @[UPLOADS_DIR] prefixed with Order ID
  const handleAttachmentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedOrder) return;
    setIsUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orderId', selectedOrder.docNo || selectedOrder.referenceNo || 'ORDER');
      const res = await api.post('/orders/upload-attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.url) {
        const newAtt = {
          id: `att_${Date.now()}`,
          url: res.data.url,
          filename: res.data.filename || file.name,
          uploadedAt: new Date().toLocaleDateString('en-GB'),
          fileSize: (file.size / 1024).toFixed(1) + ' KB',
          orderId: res.data.orderId || (selectedOrder.docNo || selectedOrder.referenceNo)
        };
        const updatedAtts = [...attachments, newAtt];
        setAttachments(updatedAtts);

        const attJson = `[[ATTACHMENT:${JSON.stringify(updatedAtts)}]]`;
        const updatedNote = (editForm.internalNote || '').replace(/\[\[ATTACHMENT:.*?\]\]/g, '').trim() + ' ' + attJson;
        setEditForm(prev => ({ ...prev, internalNote: updatedNote }));

        await api.patch(`/orders/${selectedOrder.id}/update-details`, {
          internalNote: updatedNote
        });

        Swal.fire({
          icon: 'success',
          title: 'Attachment Saved',
          text: `Saved to server directory @[UPLOADS_DIR] prefixed with Order ID (${selectedOrder.docNo || selectedOrder.referenceNo}).`,
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      }
    } catch (err) {
      console.error('Failed to upload attachment', err);
      Swal.fire({
        icon: 'error',
        title: 'Upload Failed',
        text: err?.response?.data?.error || err.message,
        confirmButtonColor: '#4f46e5'
      });
    } finally {
      setIsUploadingAttachment(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveAttachment = async (attId) => {
    const target = attachments.find(a => a.id === attId);
    const updated = attachments.filter(a => a.id !== attId);
    setAttachments(updated);

    if (target?.url) {
      try {
        await api.post('/orders/delete-attachment', {
          fileUrl: target.url,
          filename: target.filename,
          orderId: selectedOrder?.id,
          orderDocNo: selectedOrder?.docNo || selectedOrder?.referenceNo
        });
      } catch (err) {
        console.error('Failed to delete attachment from server disk:', err);
      }
    }

    if (selectedOrder) {
      const attJson = updated.length > 0 ? `[[ATTACHMENT:${JSON.stringify(updated)}]]` : '';
      const updatedNote = (editForm.internalNote || '').replace(/\[\[ATTACHMENT:.*?\]\]/g, '').trim() + (attJson ? ' ' + attJson : '');
      const updatedUrl = updated.length > 0 ? updated.map(a => a.url).join(', ') : null;
      setEditForm(prev => ({ ...prev, internalNote: updatedNote }));
      await api.patch(`/orders/${selectedOrder.id}/update-details`, {
        internalNote: updatedNote,
        attachmentUrl: updatedUrl
      });
    }
  };

  // Pagination calculations - when pageSize is 'ALL', display all records fully
  const totalPages = pageSize === 'ALL' ? 1 : Math.ceil(filteredOrders.length / Number(pageSize));
  const paginatedOrders = pageSize === 'ALL'
    ? filteredOrders
    : filteredOrders.slice(
        (currentPage - 1) * Number(pageSize),
        currentPage * Number(pageSize)
      );

  // ─────────────────────────────────────────────────────────────────────────────
  // ── DETAILED VIEW: COMPLETE SAP ENTERPRISE DOCUMENT STUDIO ON ORDER CLICK ───
  // ─────────────────────────────────────────────────────────────────────────────
  if (orderIdParam) {
    if (loadingDetail) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-sm font-semibold">Loading Complete SAP Document Studio...</span>
        </div>
      );
    }

    if (!selectedOrder) {
      return (
        <div className="p-6 max-w-4xl mx-auto text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Order Record Not Found</h2>
          <Button onClick={() => setSearchParams({})} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
            Back to Sales Log
          </Button>
        </div>
      );
    }

    const isPos = selectedOrder.type === 'POS';
    const isQuote = selectedOrder.type === 'Quotation';
    const isNeedPlanning = selectedOrder.status === 'Waiting for Production' || selectedOrder.orderMode === 'NEED_PLANNING';
    const isSO = selectedOrder.type === 'Sales Order';
    const isInvoice = selectedOrder.type === 'Invoice';
    const isPaid = (editForm.paymentStatus || selectedOrder.paymentStatus) === 'PAID';

    const clientCustName = selectedOrder.customer?.name || selectedOrder.customerName || (isPos ? 'Walk-in Cash Customer' : 'Unregistered Client');
    const clientCustPhone = selectedOrder.customer?.phone || selectedOrder.customerPhone || 'N/A';
    const clientContactPerson = selectedOrder.customer?.contactPerson || 'N/A';
    const clientGstin = editForm.taxRegNo || selectedOrder.customer?.gstin || selectedOrder.taxRegNo || '33AAAAA0000A1Z5';
    const clientRefNo = selectedOrder.customerRefNo || selectedOrder.referenceNo || 'PO-2026-REF';

    // Financial breakdown values
    const itemsList = selectedOrder.items || [];
    const totalBeforeDiscount = itemsList.reduce((sum, item) => sum + (Number(item.unitPrice || 0) * Number(item.quantity || 0)), 0);
    const lineDiscountTotal = itemsList.reduce((sum, item) => sum + (Number(item.discount || 0) * Number(item.quantity || 0)), 0);
    const discountVal = Number(selectedOrder.discountValue || lineDiscountTotal || 0);
    const freightVal = Number(selectedOrder.freight || 0);
    const loadingVal = Number(selectedOrder.loadingCharges || 0);
    const packingVal = Number(selectedOrder.packingCharges || 0);
    const otherVal = Number(selectedOrder.otherCharges || 0);
    const taxableSubtotal = Number(selectedOrder.totalSubtotal || (totalBeforeDiscount - lineDiscountTotal) || 0);
    const cgstVal = Number(selectedOrder.cgst || 0);
    const sgstVal = Number(selectedOrder.sgst || 0);
    const igstVal = Number(selectedOrder.igst || 0);
    const totalGstTax = cgstVal + sgstVal + igstVal;
    const roundOffVal = Number(selectedOrder.roundOff || 0);
    const grandTotalVal = Number(selectedOrder.grandTotal || (taxableSubtotal + totalGstTax + freightVal + loadingVal + packingVal + otherVal + roundOffVal));
    const advancePaidVal = Number(editForm.amountPaid || 0);
    const balanceDueVal = Math.max(0, grandTotalVal - advancePaidVal);
    const amountInWords = numberToWordsINR(grandTotalVal);

    const isInterState = String(editForm.placeOfSupply || '33') !== '33';

    return (
      <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300 animate__animated animate__fadeIn font-sans">
        
        {/* TOP CONTROLS & BREADCRUMB BAR */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-0.5">
            <button 
              onClick={() => setSearchParams({})}
              className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline mb-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Back to All Sales Transactions
            </button>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                {isPos ? <ShoppingBag className="w-6 h-6 text-emerald-500" /> : <FileText className="w-6 h-6 text-indigo-500" />}
                {isPos ? 'Retail POS Transaction' : 'Sales Document Studio'}: {selectedOrder.docNo || selectedOrder.referenceNo}
              </h1>

              {/* Commercial Mode Badges */}
              {isPos && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  ⚡ Retail POS (Walk-in Counter)
                </span>
              )}
              {isNeedPlanning && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  ⚙️ Need Production (Make-to-Order)
                </span>
              )}
              {isSO && !isNeedPlanning && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                  🛒 Sales Order (Direct In-Stock)
                </span>
              )}
              {isQuote && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                  📄 Price Quotation (Bid)
                </span>
              )}
              {isInvoice && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                  💼 Tax Invoice (B2B Billing)
                </span>
              )}

              {/* Payment Status Badge */}
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                isPaid
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
              }`}>
                {editForm.paymentStatus || selectedOrder.paymentStatus || 'PAID'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Interactive SAP document viewer: line items, logistics, accounting, GST ledger, document proofs, and live PDF.
            </p>
          </div>

          {/* Action Buttons Header */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            
            {/* View Switcher: Document Studio vs Vector PDF */}
            <div className="inline-flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveStudioTab('contents')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeStudioTab !== 'pdf'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                📋 Document Studio
              </button>
              <button
                type="button"
                onClick={() => setActiveStudioTab('pdf')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeStudioTab === 'pdf'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                📄 Printable PDF
              </button>
            </div>

            {/* Print Slip / Print Invoice */}
            {isPos ? (
              <Button 
                onClick={() => {
                  setLayoutMode('POS');
                  setActiveStudioTab('pdf');
                  setTimeout(handlePrintActivePdf, 300);
                }} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer h-9 px-3 flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print 80mm Slip
              </Button>
            ) : (
              <Button 
                onClick={() => {
                  setLayoutMode('A4');
                  setActiveStudioTab('pdf');
                  setTimeout(handlePrintActivePdf, 300);
                }} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer h-9 px-3 flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print A4 Invoice
              </Button>
            )}

            <Button 
              onClick={handleDownloadActivePdf} 
              variant="outline"
              className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl h-9 px-3 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> PDF
            </Button>

            {/* WhatsApp Direct Share */}
            <Button
              type="button"
              onClick={() => handleShareWhatsApp(selectedOrder)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer h-9 px-3 flex items-center gap-1.5"
              title="Share via WhatsApp Web"
            >
              <WhatsAppIcon className="w-3.5 h-3.5" /> WhatsApp
            </Button>

            {/* Email Dispatch */}
            <Button
              type="button"
              onClick={() => handleResendEmail(selectedOrder)}
              variant="outline"
              className="border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-xs font-bold rounded-xl h-9 px-3 cursor-pointer flex items-center gap-1.5"
              title="Send Invoice to Email"
            >
              <Mail className="w-3.5 h-3.5" /> Email
            </Button>

            {/* Conditional Action: View Mode (Edit buttons) vs Edit Mode (Save & Cancel buttons) */}
            {!isEditing ? (
              <>
                {/* Edit Order in SAP Studio / POS */}
                <Button
                  type="button"
                  onClick={() => {
                    if (selectedOrder.type === 'POS') {
                      navigate(`/pos?edit=${selectedOrder.id}`);
                    } else {
                      navigate(`/sales/order?edit=${selectedOrder.id}`);
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-3.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Edit line items and full parameters in SAP Studio"
                >
                  <FileText className="w-3.5 h-3.5" /> Edit in Studio
                </Button>

                {/* Change Logistics Button */}
                <Button
                  type="button"
                  onClick={() => {
                    setActiveStudioTab('logistics');
                    setIsEditing(true);
                  }}
                  variant="outline"
                  className="border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-bold text-xs h-9 px-3.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Update delivery addresses, transporter, vehicle, and dispatch logistics"
                >
                  <Truck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Change Logistics
                </Button>
              </>
            ) : (
              <>
                {/* Save Logistics button - ONLY displayed when editing */}
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveOrderUpdates}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs cursor-pointer h-9 px-3.5 flex items-center gap-1.5 disabled:opacity-50"
                  title="Save all changes to logistics and dispatch details"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{isSaving ? 'Saving...' : 'Save Logistics'}</span>
                </Button>

                {/* Cancel Edit Button */}
                <Button
                  type="button"
                  onClick={() => {
                    resetEditForm(selectedOrder);
                    setIsEditing(false);
                  }}
                  variant="outline"
                  className="border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold rounded-xl h-9 px-3 cursor-pointer flex items-center gap-1.5"
                  title="Discard changes and exit edit mode"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
              </>
            )}

            {/* Plan / Start Production Work Order */}
            {isNeedPlanning ? (
              <Button
                type="button"
                onClick={() => navigate(`/production/new?orderId=${selectedOrder.id}`, { state: { orderId: selectedOrder.id, triggerType: 'Order-Based' } })}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-xs cursor-pointer h-9 px-3.5 flex items-center gap-1.5"
                title="Open Production Planning Work Order"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" /> Plan Work Order
              </Button>
            ) : selectedOrder.status === 'Confirmed' ? (
              <Button
                type="button"
                onClick={() => handleStartProduction(selectedOrder)}
                className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer h-9 px-3 flex items-center gap-1.5"
                title="Send to Production"
              >
                <Play className="w-3.5 h-3.5" /> Start Production
              </Button>
            ) : null}

            {/* Convert Quotation to Order */}
            {isQuote && (
              <Button
                type="button"
                onClick={() => handleConvertToOrder(selectedOrder)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer h-9 px-3 flex items-center gap-1.5"
                title="Convert Quotation to Confirmed Order"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Convert to Order
              </Button>
            )}

            {/* Convert to Tax Invoice */}
            {(isQuote || isSO) && (
              <Button
                type="button"
                onClick={() => navigate(`/sales/billing?convertFrom=${selectedOrder.id}`)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer h-9 px-3.5 flex items-center gap-1.5"
                title="Convert to Tax Invoice"
              >
                <ArrowRight className="w-3.5 h-3.5" /> Convert to Invoice
              </Button>
            )}
          </div>
        </div>

        {/* ── TOP SAP DOCUMENT HEADER CARD (CUSTOMER * & DOCUMENT DETAILS) ── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs text-xs space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Customer * / Business Partner (Cols 7) */}
            <div className="lg:col-span-7 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                <span className="font-extrabold text-slate-800 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" /> Customer / Business Partner *
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ID: {selectedOrder.customerId?.substring(0, 10) || 'WALK-IN'}
                </span>
              </div>

              {/* Customer Name */}
              <div className="flex items-center">
                <label className="w-32 text-slate-500 font-bold shrink-0">Customer Name *</label>
                <div className="flex-1 font-black text-slate-900 dark:text-white text-sm">
                  {clientCustName}
                </div>
              </div>

              {/* Contact Person */}
              <div className="flex items-center">
                <label className="w-32 text-slate-500 font-medium shrink-0">Contact Person</label>
                <div className="flex-1 text-slate-700 dark:text-slate-300 font-semibold">
                  {clientContactPerson}
                </div>
              </div>

              {/* Contact Phone */}
              <div className="flex items-center">
                <label className="w-32 text-slate-500 font-medium shrink-0">Contact Phone</label>
                <div className="flex-1 font-mono text-slate-700 dark:text-slate-300 font-bold">
                  {clientCustPhone}
                </div>
              </div>

              {/* Customer Ref. No. */}
              <div className="flex items-center">
                <label className="w-32 text-slate-500 font-medium shrink-0">Customer Ref. No.</label>
                <div className="flex-1 font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                  {clientRefNo}
                </div>
              </div>

              {/* Ship To Address */}
              <div className="flex items-start">
                <label className="w-32 text-slate-500 font-medium shrink-0 pt-0.5">Ship To Address</label>
                <div className="flex-1 text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  {editForm.shipToAddress || 'Factory Gate / Store Delivery'}
                </div>
              </div>
            </div>

            {/* Right Column: Document Information (Cols 5) */}
            <div className="lg:col-span-5 space-y-2.5 lg:pl-6 lg:border-l lg:border-slate-200 dark:lg:border-slate-800">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-1.5">
                <span className="font-extrabold text-slate-800 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-500" /> Document Information
                </span>
              </div>

              {/* Document No & Series */}
              <div className="flex items-center justify-between sm:justify-start">
                <label className="w-28 text-slate-500 font-medium shrink-0">Document No.</label>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                    {selectedOrder.documentSeries || 'Primary'}
                  </span>
                  <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                    {selectedOrder.docNo || selectedOrder.referenceNo}
                  </span>
                  <span className="text-slate-400 font-mono text-[10px]">- | 0</span>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between sm:justify-start">
                <label className="w-28 text-slate-500 font-medium shrink-0">Status</label>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    {selectedOrder.status}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    isNeedPlanning 
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300' 
                      : isQuote 
                      ? 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-300'
                      : isPos 
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-300'
                  }`}>
                    {isNeedPlanning ? 'Need Planning' : (isQuote ? 'Quotation' : (isPos ? 'Retail Counter' : 'Standard Order'))}
                  </span>
                </div>
              </div>

              {/* Posting Date */}
              <div className="flex items-center justify-between sm:justify-start">
                <label className="w-28 text-slate-500 font-medium shrink-0">Posting Date</label>
                <div className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {new Date(selectedOrder.createdAt).toLocaleDateString('en-GB')}
                </div>
              </div>

              {/* Delivery Date */}
              <div className="flex items-center justify-between sm:justify-start">
                <label className="w-28 text-slate-500 font-medium shrink-0">Delivery Date</label>
                <div className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {selectedOrder.deliveryDate ? new Date(selectedOrder.deliveryDate).toLocaleDateString('en-GB') : 'Immediate Counter'}
                </div>
              </div>

              {/* Document Date */}
              <div className="flex items-center justify-between sm:justify-start">
                <label className="w-28 text-slate-500 font-medium shrink-0">Document Date</label>
                <div className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {new Date(selectedOrder.createdAt).toLocaleDateString('en-GB')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SAP STUDIO TAB STRIP (6 TABS - NO OVERFLOW) ── */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 flex-wrap select-none pt-1">
          {[
            { id: 'contents', label: '📋 Contents (Line Items)', count: itemsList.length },
            { id: 'logistics', label: '🚚 Logistics' },
            { id: 'accounting', label: '💳 Accounting' },
            { id: 'tax', label: '🏛️ Tax & GST Ledger' },
            { id: 'attachments', label: '📎 Attachments & Proof Photos', count: attachments.length },
            { id: 'pdf', label: '📄 Printable PDF' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveStudioTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-bold transition-all cursor-pointer rounded-t-xl -mb-[1px] flex items-center gap-1.5 whitespace-nowrap ${
                activeStudioTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-t-2 border-x border-t-indigo-600 border-x-slate-200 dark:border-x-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeStudioTab === tab.id 
                    ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB 1: CONTENTS (Line Items Table with Batches & Feasibility - FULL DISPLAY) ── */}
        {activeStudioTab === 'contents' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3 p-4">
            
            {/* Grid Sub-Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">Item/Service Type:</span>
                  <span className="font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">Item</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">Summary Type:</span>
                  <span className="font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">No Summary</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                Catalog Feasibility Verified • {itemsList.length} Rows Registered
              </div>
            </div>

            {/* Line Items Table */}
            <div className="w-full text-xs">
              <table className="w-full text-left table-auto">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-3 text-center w-10">#</th>
                    <th className="px-3 py-3 w-28">System Code</th>
                    <th className="px-3 py-3">Product Name & Specifications</th>
                    <th className="px-3 py-3">Category & Base</th>
                    <th className="px-3 py-3 text-center">UOM</th>
                    <th className="px-3 py-3 text-right">Quantity</th>
                    <th className="px-3 py-3 text-right">Rate (₹)</th>
                    <th className="px-3 py-3 text-right">Disc %</th>
                    <th className="px-3 py-3 text-right">Tax Code</th>
                    <th className="px-3 py-3 text-right">Line Total (₹)</th>
                    <th className="px-3 py-3">Batch / Stock Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {itemsList.map((item, idx) => {
                    const qty = Number(item.quantity) || 0;
                    const rate = Number(item.unitPrice) || 0;
                    const discPct = Number(item.discountPercent || (item.discount ? (item.discount / rate) * 100 : 0));
                    const discAmt = (rate * (discPct / 100)) * qty;
                    const lineTotal = Math.max(0, (rate * qty) - discAmt);
                    const gstRateVal = Number(item.gstRate || 5);
                    const taxCode = gstRateVal === 18 ? 'SCG18 (18%)' : (gstRateVal === 12 ? 'SCG12 (12%)' : (gstRateVal === 28 ? 'SCG28 (28%)' : 'SCG5 (5%)'));

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 py-3 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                        <td className="px-3 py-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                          {item.product?.code || item.product?.systemCode || `BFD10${idx + 1}`}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {item.productName || item.product?.name || 'Finished Ice Cream Product'}
                          </div>
                          {item.hsnCode && (
                            <span className="text-[10px] text-slate-400 font-mono">HSN: {item.hsnCode}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                          <div>{item.product?.category?.name || 'Ice Cream'}</div>
                          <span className="text-[10px] text-slate-400">{item.product?.subcategory?.name || 'Standard'}</span>
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-slate-500">
                          {item.uomName || item.product?.unit?.name || 'pcs'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-black text-slate-900 dark:text-white">
                          {qty}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          ₹{rate.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-500">
                          {discPct > 0 ? `${discPct.toFixed(0)}%` : '0%'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-[10px]">
                            {taxCode}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                          ₹{lineTotal.toFixed(2)}
                        </td>
                        <td className="px-3 py-3">
                          {item.batchNo ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                Batch: {item.batchNo}
                              </span>
                              {item.expiryDate && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Exp: {new Date(item.expiryDate).toLocaleDateString('en-GB')}
                                </div>
                              )}
                            </div>
                          ) : isNeedPlanning ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                              Scheduled for Production
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-bold">
                              ✓ Direct Warehouse Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 2: LOGISTICS (Destination, Addresses & Transport) ── */}
        {activeStudioTab === 'logistics' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs text-xs space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Destination & Delivery Addresses */}
              <div className="space-y-3">
                <div className="font-extrabold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-1.5 text-xs flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-500" />
                  <span>Destination & Delivery Addresses</span>
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Ship-To Address</label>
                  <textarea
                    rows={4}
                    disabled={!isEditing}
                    value={editForm.shipToAddress}
                    onChange={(e) => setEditForm(prev => ({ ...prev, shipToAddress: e.target.value }))}
                    placeholder="Enter complete shipping destination address..."
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-600 dark:disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Bill-To Address</label>
                  <textarea
                    rows={4}
                    disabled={!isEditing}
                    value={editForm.billToAddress}
                    onChange={(e) => setEditForm(prev => ({ ...prev, billToAddress: e.target.value }))}
                    placeholder="Enter customer billing address..."
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-600 dark:disabled:text-slate-400"
                  />
                </div>
              </div>

              {/* Transport & Dispatch Logistics */}
              <div className="space-y-3">
                <div className="font-extrabold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-1.5 text-xs flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-500" />
                  <span>Transport & Dispatch Logistics</span>
                </div>
                
                <div className="flex items-center">
                  <label className="w-36 text-slate-500 font-bold">Shipping Method</label>
                  <select
                    disabled={!isEditing}
                    value={editForm.shippingMethod}
                    onChange={(e) => setEditForm(prev => ({ ...prev, shippingMethod: e.target.value }))}
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none font-semibold disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-600 dark:disabled:text-slate-400"
                  >
                    <option value="Road Transport">Road Transport</option>
                    <option value="Rail Cargo">Rail Cargo</option>
                    <option value="Air Cargo">Air Cargo</option>
                    <option value="Express Courier">Express Courier</option>
                    <option value="Customer Self-Pickup">Customer Self-Pickup</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <label className="w-36 text-slate-500 font-bold">Transporter Name</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={editForm.transporterName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, transporterName: e.target.value }))}
                    placeholder="Carrier or Agency name..."
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-600 dark:disabled:text-slate-400"
                  />
                </div>

                <div className="flex items-center">
                  <label className="w-36 text-slate-500 font-bold">Vehicle No</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={editForm.vehicleNo}
                    onChange={(e) => setEditForm(prev => ({ ...prev, vehicleNo: e.target.value }))}
                    placeholder="e.g. TN-01-AB-1234"
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono uppercase outline-none disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-600 dark:disabled:text-slate-400"
                  />
                </div>

                <div className="flex items-center">
                  <label className="w-36 text-slate-500 font-bold">Docket / LR Number</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={editForm.lrNo}
                    onChange={(e) => setEditForm(prev => ({ ...prev, lrNo: e.target.value }))}
                    placeholder="LR-000000"
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-600 dark:disabled:text-slate-400"
                  />
                </div>

                <div className="flex items-center">
                  <label className="w-36 text-slate-500 font-bold">e-Way Bill No.</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={editForm.ewayBillNo}
                    onChange={(e) => setEditForm(prev => ({ ...prev, ewayBillNo: e.target.value }))}
                    placeholder="12-digit e-way bill number"
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-600 dark:disabled:text-slate-400"
                  />
                </div>

                <div className="flex items-center">
                  <label className="w-36 text-slate-500 font-bold">e-Way Bill Date</label>
                  <input
                    type="date"
                    disabled={!isEditing}
                    value={editForm.ewayBillDate}
                    onChange={(e) => setEditForm(prev => ({ ...prev, ewayBillDate: e.target.value }))}
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-600 dark:disabled:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Save Logistics Button - ONLY visible when editing */}
            {isEditing && (
              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetEditForm(selectedOrder);
                    setIsEditing(false);
                  }}
                  className="text-xs font-bold h-9 px-4 rounded-xl cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveOrderUpdates}
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Logistics Updates'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: ACCOUNTING & BP FINANCIALS ── */}
        {activeStudioTab === 'accounting' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs text-xs space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Payment Terms & Settlement */}
              <div className="space-y-3">
                <div className="font-extrabold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-1.5 text-xs flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                  <span>Payment Terms & Settlement</span>
                </div>

                <div className="flex items-center">
                  <label className="w-36 text-slate-500 font-bold">Payment Terms</label>
                  <select
                    disabled={!isEditing}
                    value={editForm.paymentTerms}
                    onChange={(e) => setEditForm(prev => ({ ...prev, paymentTerms: e.target.value }))}
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none font-semibold disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-600 dark:disabled:text-slate-400"
                  >
                    <option value="Not Paid">Not Paid</option>
                    <option value="Immediate Cash">Immediate Cash</option>
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Advance Received">Advance Received</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <label className="w-36 text-slate-500 font-bold">Payment Mode</label>
                  <select
                    disabled={!isEditing}
                    value={editForm.paymentMethod}
                    onChange={(e) => setEditForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none font-semibold disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-600 dark:disabled:text-slate-400"
                  >
                    <option value="Bank Transfer / NEFT">Bank Transfer / NEFT</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI / QR">UPI / QR</option>
                    <option value="Credit / Debit Card">Credit / Debit Card</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <label className="w-36 text-slate-500 font-bold">Payment Status</label>
                  <select
                    disabled={!isEditing}
                    value={editForm.paymentStatus}
                    onChange={(e) => setEditForm(prev => ({ ...prev, paymentStatus: e.target.value }))}
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none font-bold text-emerald-600 disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-600 dark:disabled:text-slate-400"
                  >
                    <option value="PAID">PAID</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <label className="w-36 text-slate-500 font-bold">Advance Received (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!isEditing}
                    value={editForm.amountPaid}
                    onChange={(e) => setEditForm(prev => ({ ...prev, amountPaid: parseFloat(e.target.value) || 0 }))}
                    className="w-48 h-9 px-3 font-mono font-bold text-right rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-600 dark:disabled:text-slate-400"
                  />
                </div>

                <div className="flex items-center pt-1 border-t border-slate-100 dark:border-slate-800">
                  <label className="w-36 text-slate-700 dark:text-slate-300 font-black">Balance Due</label>
                  <div className="font-mono font-black text-emerald-600 text-base">
                    ₹{balanceDueVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Financial Records & BP Account */}
              <div className="space-y-3">
                <div className="font-extrabold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-1.5 text-xs flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  <span>Financial Records & BP Account</span>
                </div>

                <div className="flex items-center">
                  <label className="w-36 text-slate-500 font-bold">Journal Remark</label>
                  <input
                    type="text"
                    readOnly
                    value={`Sales Order - ${clientCustName}`}
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 font-medium outline-none"
                  />
                </div>

                <div className="flex items-center">
                  <label className="w-36 text-slate-500 font-bold">BP Bank Code</label>
                  <input
                    type="text"
                    readOnly
                    value={selectedOrder.customer?.bankAccount ? `${selectedOrder.customer.bankName || 'SBI'} (${selectedOrder.customer.bankAccount})` : 'Primary Bank Default'}
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 font-medium outline-none"
                  />
                </div>

                <div className="flex items-center">
                  <label className="w-36 text-slate-500 font-bold">Document Total</label>
                  <div className="font-mono font-black text-slate-900 dark:text-white text-sm">
                    ₹{grandTotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Save Accounting Button - ONLY visible when editing */}
            {isEditing && (
              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetEditForm(selectedOrder);
                    setIsEditing(false);
                  }}
                  className="text-xs font-bold h-9 px-4 rounded-xl cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveOrderUpdates}
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Accounting Updates'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: TAX & GST LEDGER ── */}
        {activeStudioTab === 'tax' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs text-xs space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* GST Intelligence */}
              <div className="space-y-3 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/30">
                <div className="font-extrabold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-1.5 flex items-center justify-between">
                  <span>GST Treatment & Supply State</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 font-black">
                    Intelligent Detection
                  </span>
                </div>

                <div className="flex items-center">
                  <label className="w-36 text-slate-500 font-bold">Customer GSTIN</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={editForm.taxRegNo}
                    onChange={(e) => setEditForm(prev => ({ ...prev, taxRegNo: e.target.value.toUpperCase() }))}
                    placeholder="33AAAAA0000A1Z5"
                    className="flex-1 h-9 px-3 font-mono font-bold uppercase rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-600 dark:disabled:text-slate-400"
                  />
                </div>

                <div className="flex items-center">
                  <label className="w-36 text-slate-500 font-bold">Place of Supply</label>
                  <select
                    disabled={!isEditing}
                    value={editForm.placeOfSupply}
                    onChange={(e) => setEditForm(prev => ({ ...prev, placeOfSupply: e.target.value }))}
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none font-semibold disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-600 dark:disabled:text-slate-400"
                  >
                    {getIndianStates().map(st => (
                      <option key={st.code} value={st.code}>
                        {st.code} - {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-blue-900 dark:text-blue-300">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>{isInterState ? '🌐 Inter-State Supply (IGST Applied)' : '🏛️ Intra-State Supply (CGST + SGST Applied)'}</span>
                  </div>
                  <div className="text-[11px] opacity-85 mt-1">
                    Seller: Tamil Nadu (33) ➔ Buyer Place of Supply: State ({editForm.placeOfSupply || '33'})
                  </div>
                </div>
              </div>

              {/* Charges & Tax Ledger */}
              <div className="space-y-3 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/30">
                <div className="font-extrabold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  Charges & Tax Ledger
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Freight (₹)</label>
                    <input
                      type="text"
                      readOnly
                      value={`₹${freightVal.toFixed(2)}`}
                      className="w-full h-8 px-2.5 text-right font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Loading (₹)</label>
                    <input
                      type="text"
                      readOnly
                      value={`₹${loadingVal.toFixed(2)}`}
                      className="w-full h-8 px-2.5 text-right font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Packing (₹)</label>
                    <input
                      type="text"
                      readOnly
                      value={`₹${packingVal.toFixed(2)}`}
                      className="w-full h-8 px-2.5 text-right font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Other Charges (₹)</label>
                    <input
                      type="text"
                      readOnly
                      value={`₹${otherVal.toFixed(2)}`}
                      className="w-full h-8 px-2.5 text-right font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* GST Computation Summary */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-white">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Taxable Subtotal</div>
                  <div className="font-mono font-black text-sm text-white">₹{taxableSubtotal.toFixed(2)}</div>
                </div>
                {!isInterState ? (
                  <>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">CGST (@2.5%)</div>
                      <div className="font-mono font-bold text-sm text-amber-400">₹{cgstVal.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">SGST (@2.5%)</div>
                      <div className="font-mono font-bold text-sm text-amber-400">₹{sgstVal.toFixed(2)}</div>
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">IGST (@5%)</div>
                    <div className="font-mono font-bold text-sm text-amber-400">₹{igstVal.toFixed(2)}</div>
                  </div>
                )}
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total GST Tax</div>
                  <div className="font-mono font-black text-sm text-emerald-400">₹{totalGstTax.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: ATTACHMENTS & PROOF PHOTOS ── */}
        {activeStudioTab === 'attachments' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs text-xs space-y-4">
            
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <div className="font-extrabold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-amber-500" />
                  <span>Order Document Attachments & Proof Photos</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Images are saved directly to server directory <span className="font-mono font-bold text-slate-700 dark:text-slate-300">@[UPLOADS_DIR]</span> prefixed with Order ID (<span className="font-mono font-bold text-amber-600">{selectedOrder.docNo || selectedOrder.referenceNo}</span>).
                </p>
              </div>

              {/* Upload Triggers */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleAttachmentUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingAttachment}
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isUploadingAttachment ? 'Uploading...' : 'Take Camera Photo'}</span>
                </button>

                <input
                  type="file"
                  ref={galleryInputRef}
                  accept="image/*,application/pdf"
                  onChange={handleAttachmentUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingAttachment}
                  onClick={() => galleryInputRef.current?.click()}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  <span>{isUploadingAttachment ? 'Uploading...' : 'Upload from Gallery'}</span>
                </button>
              </div>
            </div>

            {/* Attachments List */}
            {attachments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                {attachments.map(att => (
                  <div
                    key={att.id}
                    className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between space-y-2 group shadow-xs"
                  >
                    <div className="flex items-start gap-3">
                      {(() => {
                        const isPdf = att.filename?.toLowerCase().endsWith('.pdf') || att.url?.toLowerCase().includes('.pdf');
                        return (
                          <div
                            onClick={() => {
                              if (isPdf) {
                                window.open(att.url, '_blank');
                              } else {
                                setPreviewPhotoUrl(att.url);
                              }
                            }}
                            className="w-16 h-16 rounded-lg bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600 cursor-pointer relative group-hover:opacity-90 flex items-center justify-center"
                            title={isPdf ? 'Click to open PDF' : 'Click to preview image'}
                          >
                            {isPdf ? (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                                <FileText className="w-6 h-6" />
                                <span className="text-[9px] font-bold mt-0.5 tracking-wider">PDF</span>
                              </div>
                            ) : (
                              <img
                                src={att.url}
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
                          Order ID: <span className="font-bold text-amber-600">{att.orderId || selectedOrder.docNo}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {att.fileSize} • {att.uploadedAt}
                        </div>
                        <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Saved in UPLOADS_DIR
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => window.open(att.url, '_blank')}
                        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
                      >
                        <ExternalLink className="w-3 h-3" /> View Full
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer text-[11px] ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center space-y-2">
                <Paperclip className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="font-bold text-slate-700 dark:text-slate-300">No attachments uploaded yet for this Sales Order</div>
                <p className="text-slate-400 text-[11px]">
                  Click Take Camera Photo to snap delivery/PO slip on mobile, or Upload from Gallery to attach invoice docs.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 6: PRINTABLE PDF PREVIEW ── */}
        {activeStudioTab === 'pdf' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Format:</span>
                <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setLayoutMode('A4')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      layoutMode === 'A4'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    A4 Standard Tax Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutMode('POS')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      layoutMode === 'POS'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    80mm Thermal Receipt Slip
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  onClick={handlePrintActivePdf} 
                  className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer h-8 px-3"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" /> Spool Print
                </Button>
                <Button 
                  onClick={handleDownloadActivePdf} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer h-8 px-3"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Download
                </Button>
              </div>
            </div>

            <div className="w-full min-h-[700px] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden bg-slate-950 shadow-xl relative">
              {activePdfUrl ? (
                <iframe
                  id="sales-detail-pdf-frame"
                  src={activePdfUrl}
                  className="w-full h-[700px] border-none"
                  title="Invoice Vector PDF Frame"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <span className="text-xs font-semibold">Compiling PDF Vector...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BOTTOM FINANCIAL TOTALS & REMARKS AUDIT BAR ── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs text-xs space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Side: Audit & Remarks (Cols 6) */}
            <div className="lg:col-span-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Buyer / Employee</label>
                  <input
                    type="text"
                    readOnly
                    value={editForm.salesEmployee}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Owner</label>
                  <input
                    type="text"
                    readOnly
                    value={editForm.owner}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Remarks & Dispatch Notes</label>
                <textarea
                  rows={3}
                  disabled={!isEditing}
                  value={editForm.remarks}
                  onChange={(e) => setEditForm(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Enter dispatch notes, production priority, terms, or customer special requests..."
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-600 dark:disabled:text-slate-400"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Amount in Words:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 italic">{amountInWords}</span>
              </div>
            </div>

            {/* Right Side: Financial Ledger Summary (Cols 6) */}
            <div className="lg:col-span-6 space-y-2 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 lg:pl-6 pt-3 lg:pt-0">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Total Before Discount:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">₹{totalBeforeDiscount.toFixed(2)} INR</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Discount Amount:</span>
                <span className="font-mono text-rose-500">-₹{discountVal.toFixed(2)} INR</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Freight & Logistics Charges:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">₹{(freightVal + loadingVal + packingVal + otherVal).toFixed(2)} INR</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Taxable Subtotal:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">₹{taxableSubtotal.toFixed(2)} INR</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">GST Taxes (CGST+SGST / IGST):</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">₹{totalGstTax.toFixed(2)} INR</span>
              </div>

              {roundOffVal !== 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Round-Off Adjustment:</span>
                  <span className="font-mono text-slate-500">₹{roundOffVal.toFixed(2)} INR</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 text-sm border-t-2 border-slate-200 dark:border-slate-700">
                <span className="font-black text-slate-900 dark:text-white uppercase">Net Grand Total:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-lg font-mono">
                  ₹{grandTotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR
                </span>
              </div>

              <div className="flex justify-between items-center text-xs pt-1 text-slate-600 dark:text-slate-400">
                <span>Advance Paid: <strong className="font-mono text-slate-800 dark:text-white">₹{advancePaidVal.toFixed(2)}</strong></span>
                <span>Balance Due: <strong className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">₹{balanceDueVal.toFixed(2)}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal for Zooming Attached Photos */}
        {previewPhotoUrl && (
          <div 
            onClick={() => setPreviewPhotoUrl(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          >
            <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 p-2 rounded-2xl overflow-hidden shadow-2xl">
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="absolute top-4 right-4 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full p-2 cursor-pointer z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={previewPhotoUrl}
                alt="Order Document Attachment Zoom"
                className="max-w-full max-h-[85vh] object-contain rounded-xl"
              />
            </div>
          </div>
        )}

      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── TABLE LIST VIEW: 5 CLEAN CORE COMMERCIAL TABS & DIRECT ROW BADGES ───────
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      <DashboardBackButton />
      
      {isReadOnly && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-medium mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to Sales Orders & Ledgers.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
              <FileText className="w-5.5 h-5.5 mr-2 text-indigo-600 shrink-0" />
              Sales Orders & POS Transactions Registry
            </h1>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE AUTO-SYNC</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Commercial order registry: Walk-in POS, Direct In-Stock Orders, Make-to-Order Deficit Planning, and Quotations.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            onClick={() => navigate('/sales/billing')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-3.5 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> New B2B Invoice
          </Button>
          <Button
            onClick={() => navigate('/sales/order')}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-3.5 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" /> Sales Order Studio
          </Button>
        </div>
      </div>

      {/* ── 6 CLEAN COMMERCIAL CATEGORY TABS (NO OVERFLOW, FULL DISPLAY) ── */}
      <div className="flex flex-col gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {[
            { id: 'ALL', label: 'All Transactions', count: tabCounts.all, icon: Layers },
            { id: 'POS', label: '⚡ Retail POS', count: tabCounts.pos, icon: ShoppingBag, color: 'text-emerald-600' },
            { id: 'Invoice', label: '💼 Tax Invoices', count: tabCounts.invoices, icon: FileText, color: 'text-indigo-600' },
            { id: 'Sales Order', label: '🛒 Sales Orders', count: tabCounts.salesOrders, icon: CheckCircle2, color: 'text-blue-600' },
            { id: 'Waiting for Production', label: '⚙️ Need Planning', count: tabCounts.needProduction, icon: Clock, color: 'text-amber-500' },
            { id: 'Quotation', label: '📄 Quotations', count: tabCounts.quotations, icon: Sparkles, color: 'text-purple-600' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setTypeFilter(tab.id); setCurrentPage(1); }}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                typeFilter === tab.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
              }`}
            >
              <tab.icon className={`w-3.5 h-3.5 ${tab.color || ''}`} />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                typeFilter === tab.id ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Sort Row */}
        <div className="bg-slate-50/50 dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search ref, customer, phone, GSTIN, cashier..." 
              className="pl-9 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs h-9 rounded-xl focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 font-semibold h-9 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="PAID">PAID</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 font-semibold h-9 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="date_desc">Date (Newest First)</option>
                <option value="date_asc">Date (Oldest First)</option>
                <option value="doc_asc">Doc Ref (Ascending)</option>
                <option value="doc_desc">Doc Ref (Descending)</option>
                <option value="party_asc">Party Name (A → Z)</option>
                <option value="amount_desc">Grand Total (Highest)</option>
                <option value="amount_asc">Grand Total (Lowest)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(e.target.value); setCurrentPage(1); }}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-xs text-slate-700 dark:text-slate-300 font-semibold h-9 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All ({filteredOrders.length})</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── ORDERS TABLE: DISTINCT COMMERCIAL BADGES & ICON-ONLY ACTIONS (FULL DISPLAY, ZERO OVERFLOW) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="w-full text-xs">
          <table className="w-full text-xs text-left table-auto">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-3.5 py-3 cursor-pointer group text-left w-[18%]" onClick={() => handleToggleSort('doc')}>
                  <div className="flex items-center gap-1">
                    <span>Doc Ref & Type</span>
                    {getSortIcon('doc')}
                  </div>
                </th>
                <th className="px-3.5 py-3 cursor-pointer group text-left w-[24%]" onClick={() => handleToggleSort('party')}>
                  <div className="flex items-center gap-1">
                    <span>Customer & Details</span>
                    {getSortIcon('party')}
                  </div>
                </th>
                <th className="px-3 py-3 text-center cursor-pointer group w-[11%]" onClick={() => handleToggleSort('date')}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Date & Time</span>
                    {getSortIcon('date')}
                  </div>
                </th>
                <th className="px-3 py-3 text-center cursor-pointer group w-[11%]" onClick={() => handleToggleSort('payment')}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Payment</span>
                    {getSortIcon('payment')}
                  </div>
                </th>
                <th className="px-3.5 py-3 text-right cursor-pointer group w-[12%]" onClick={() => handleToggleSort('amount')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Amount</span>
                    {getSortIcon('amount')}
                  </div>
                </th>
                <th className="px-3 py-3 text-center w-[11%]">Fulfillment</th>
                <th className="px-3 py-3 text-center w-[13%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">Loading sales records...</td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">No records found matching criteria.</td>
                </tr>
              ) : (
                paginatedOrders.map(order => {
                  const isPos = order.type === 'POS';
                  const isInvoice = order.type === 'Invoice';
                  const isQuote = order.type === 'Quotation';
                  const isNeedPlanning = order.status === 'Waiting for Production' || order.orderMode === 'NEED_PLANNING';
                  const isSO = order.type === 'Sales Order';

                  const grandTotalVal = Number(order.grandTotal || order.totalSubtotal || 0);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                      {/* Document Ref & Specific Commercial Badge */}
                      <td className="px-3.5 py-3 align-middle">
                        <div className="font-mono font-bold text-slate-900 dark:text-white text-xs truncate max-w-[150px]">
                          {order.docNo || order.referenceNo}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          {isPos && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs whitespace-nowrap">
                              <ShoppingBag className="w-2.5 h-2.5" /> ⚡ Retail POS
                            </span>
                          )}
                          {isNeedPlanning && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-xs whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" /> ⚙️ Need Planning
                            </span>
                          )}
                          {isSO && !isNeedPlanning && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border border-blue-300 dark:border-blue-800 shadow-xs whitespace-nowrap">
                              <CheckCircle2 className="w-2.5 h-2.5" /> 🛒 Sales Order
                            </span>
                          )}
                          {isQuote && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-300 border border-purple-300 dark:border-purple-800 shadow-xs whitespace-nowrap">
                              <Sparkles className="w-2.5 h-2.5" /> 📄 Quotation
                            </span>
                          )}
                          {isInvoice && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 shadow-xs whitespace-nowrap">
                              <FileText className="w-2.5 h-2.5" /> 💼 Tax Invoice
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Party & POS Counter Info */}
                      <td className="px-3.5 py-3 align-middle">
                        <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                          <span className="truncate max-w-[180px]" title={order.customerName || order.customer?.name || (isPos ? 'Walk-in Cash Customer' : 'Unregistered Client')}>
                            {order.customerName || order.customer?.name || (isPos ? 'Walk-in Cash Customer' : 'Unregistered Client')}
                          </span>
                          {(order.customer?.customerType === 'B2B' || order.customer?.customerType === 'DISTRIBUTOR' || order.customer?.customerType === 'WHOLESALE') ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                              <Building2 className="w-2.5 h-2.5" /> B2B
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                              <User className="w-2.5 h-2.5" /> Retail
                            </span>
                          )}
                        </div>
                        
                        {isPos ? (
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 font-mono truncate max-w-[220px]">
                            <span className="bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded font-bold">
                              {order.counterId || 'COUNTER-01'}
                            </span>
                            <span>•</span>
                            <span>{order.cashierName || 'Staff'}</span>
                            {order.customerPhone && <span>• {order.customerPhone}</span>}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 font-mono truncate max-w-[220px]">
                            {(order.customer?.gstin || order.taxRegNo) && (
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                GSTIN: {order.customer?.gstin || order.taxRegNo}
                              </span>
                            )}
                            {order.customer?.phone && <span>Ph: {order.customer.phone}</span>}
                          </div>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="px-3 py-3 text-center align-middle text-slate-500 font-semibold font-mono text-[11px]">
                        <div>{new Date(order.createdAt).toLocaleDateString('en-GB')}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Payment Info */}
                      <td className="px-3 py-3 text-center align-middle">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                            order.paymentStatus === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                              : order.paymentStatus === 'PARTIAL'
                              ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                          }`}>
                            {order.paymentStatus || (isPos ? 'PAID' : 'PENDING')}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[90px]">
                            {order.paymentTerms || (isPos ? 'Cash' : 'Net 30')}
                          </span>
                        </div>
                      </td>

                      {/* Grand Total */}
                      <td className="px-3.5 py-3 text-right align-middle">
                        <div className="font-black text-slate-900 dark:text-white font-mono text-xs sm:text-sm">
                          ₹{grandTotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {order.cgst > 0 && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Tax: ₹{(Number(order.cgst) + Number(order.sgst) + Number(order.igst)).toFixed(2)}
                          </div>
                        )}
                      </td>

                      {/* Fulfillment Status */}
                      <td className="px-3 py-3 text-center align-middle">
                        {isNeedPlanning ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                            Need Planning
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                            order.status === 'Delivered'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : order.status === 'Ready for Shipment' || order.status === 'Confirmed'
                              ? 'bg-blue-500/10 text-blue-700 border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                          }`}>
                            {order.status || 'Confirmed'}
                          </span>
                        )}
                      </td>

                      {/* Actions Column (STRICTLY ICON-ONLY, NO OVERFLOW) */}
                      <td className="px-3 py-2.5 text-center align-middle">
                        <div className="flex items-center justify-center gap-1 flex-nowrap">
                          
                          {/* 1. View Details (Document Studio) */}
                          <button
                            type="button"
                            onClick={() => setSearchParams({ id: order.id })}
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
                            title="View Details (SAP Document Studio)"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* 2. Edit Order in Studio / POS */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isPos) {
                                navigate(`/pos?edit=${order.id}`);
                              } else {
                                navigate(`/sales/order?edit=${order.id}`);
                              }
                            }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
                            title={isPos ? "Edit in POS" : "Edit in Order Studio"}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {/* 3. Print Slip / Invoice */}
                          {isPos ? (
                            <button
                              type="button"
                              onClick={() => {
                                setLayoutMode('POS');
                                setSearchParams({ id: order.id });
                              }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 transition-transform active:scale-95 cursor-pointer shrink-0"
                              title="Print 80mm POS Slip"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setLayoutMode('A4');
                                setSearchParams({ id: order.id });
                              }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-transform active:scale-95 cursor-pointer shrink-0"
                              title="Print A4 Tax Invoice"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* 4. WhatsApp (Official WhatsApp SVG Logo) */}
                          <button
                            type="button"
                            onClick={() => handleShareWhatsApp(order)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
                            title="Share on WhatsApp"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                          </button>

                          {/* 5. Resend to Email */}
                          <button
                            type="button"
                            onClick={() => handleResendEmail(order)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-transform active:scale-95 cursor-pointer shrink-0"
                            title="Send Invoice to Email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>

                          {/* 6. Plan Work Order (for Need Planning orders) */}
                          {isNeedPlanning && (
                            <button
                              type="button"
                              onClick={() => navigate(`/production/new?orderId=${order.id}`, { state: { orderId: order.id, triggerType: 'Order-Based' } })}
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
                              title="Plan Production Work Order"
                            >
                              <Play className="w-3.5 h-3.5 fill-slate-950" />
                            </button>
                          )}

                          {/* 7. Start Production (for Confirmed orders) */}
                          {order.status === 'Confirmed' && !isNeedPlanning && (
                            <button
                              type="button"
                              onClick={() => handleStartProduction(order)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 dark:text-amber-400 border border-amber-300 dark:border-amber-700 transition-transform active:scale-95 cursor-pointer shrink-0"
                              title="Start Production Queue"
                            >
                              <Play className="w-3.5 h-3.5 fill-amber-500" />
                            </button>
                          )}

                          {/* 8. Convert Quotation to Order */}
                          {isQuote && (
                            <button
                              type="button"
                              onClick={() => handleConvertToOrder(order)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 transition-transform active:scale-95 cursor-pointer shrink-0"
                              title="Convert Quotation to Confirmed Order"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* 9. Convert to Tax Invoice */}
                          {(isQuote || isSO) && order.status !== 'Delivered' && (
                            <button
                              type="button"
                              onClick={() => navigate(`/sales/billing?convertFrom=${order.id}`)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition-transform active:scale-95 cursor-pointer shrink-0"
                              title="Convert to Tax Invoice"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & Pagination Controls */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
            {pageSize === 'ALL'
              ? `Displaying all ${filteredOrders.length} transaction records`
              : `Showing ${(currentPage - 1) * Number(pageSize) + 1} to ${Math.min(currentPage * Number(pageSize), filteredOrders.length)} of ${filteredOrders.length} entries`
            }
          </div>

          {pageSize !== 'ALL' && totalPages > 1 && (
            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>
          )}

          <div className="text-xs text-slate-400 font-medium order-3">
            Total records: {filteredOrders.length}
          </div>
        </div>
      </div>
    </div>
  );
}
