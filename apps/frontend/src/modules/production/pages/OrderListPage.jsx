import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import {
  ShoppingCart, Search, RefreshCw, Plus, Edit, Trash2, Eye,
  Download, Printer, X, ChevronLeft, Package,
  TrendingUp, Calendar, IndianRupee, Filter, ArrowUpDown, Info, Sparkles, AlertCircle, Loader2, AlertTriangle
} from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import useAuthStore from '@/app/store/authStore';
import AddOrderPage from './AddOrderPage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import { Pagination } from '@/components/ui/Pagination';

const STATUS_CONFIG = {
  'Quotation':            { bg: 'bg-blue-50 dark:bg-blue-500/10',   text: 'text-blue-600 dark:text-blue-400',   dot: 'bg-blue-500 dark:bg-blue-400',   border: 'border-blue-100 dark:border-blue-500/20' },
  'Confirmed':            { bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500 dark:bg-violet-400', border: 'border-violet-100 dark:border-violet-500/20' },
  'Waiting for Production':{ bg: 'bg-slate-100 dark:bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400',  dot: 'bg-slate-500 dark:bg-slate-400',  border: 'border-slate-200 dark:border-slate-500/20' },
  'In Production':        { bg: 'bg-amber-50 dark:bg-amber-500/10',  text: 'text-amber-700 dark:text-amber-400',  dot: 'bg-amber-500 dark:bg-amber-400',  border: 'border-amber-100 dark:border-amber-500/20' },
  'Ready for Shipment':   { bg: 'bg-teal-50 dark:bg-teal-500/10',   text: 'text-teal-600 dark:text-teal-400',   dot: 'bg-teal-500 dark:bg-teal-400',   border: 'border-teal-100 dark:border-teal-500/20' },
  'Delivered':            { bg: 'bg-emerald-50 dark:bg-emerald-500/10',text: 'text-emerald-600 dark:text-emerald-400',dot: 'bg-emerald-500 dark:bg-emerald-400',border: 'border-emerald-100 dark:border-emerald-500/20' },
  'Cancelled':            { bg: 'bg-rose-50 dark:bg-rose-500/10',   text: 'text-rose-600 dark:text-rose-400',   dot: 'bg-rose-500 dark:bg-rose-400',   border: 'border-rose-100 dark:border-rose-500/20' },
};

const PAGE_SIZE = 10;

export default function OrderListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderIdParam = searchParams.get('id');
  const user = useAuthStore(s => s.user);
  const canEdit = ['MAIN_MASTER', 'SALES_TEAM', 'PURCHASE_ACCOUNTANT'].includes(user?.role);

  const [view, setView] = useState({ type: 'list', prefill: null });

  useEffect(() => {
    if (canEdit && (location.pathname === '/orders/add' || location.pathname.startsWith('/orders/edit/') || location.state)) {
      setView({ type: 'create', prefill: location.state });
    } else {
      setView({ type: 'list', prefill: null });
    }
  }, [location, canEdit]);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfUrlA4, setPdfUrlA4] = useState(null);
  const [pdfUrlBill, setPdfUrlBill] = useState(null);
  const [previewMode, setPreviewMode] = useState('invoice');

  // Load Company & Tax Settings dynamically from localStorage
  const savedSettings = localStorage.getItem('leonex_erp_tax_settings');
  let compName = 'LEONEX SYSTEMS PRIVATE LIMITED';
  let compAddr = 'O.T, Madras Thiruvallur High Rd, opp. Stedeford Hospital, Chennai, Tamil Nadu 600053';
  let compGstin = '33AABCL0702C1ZG';

  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      if (parsed.companyName) compName = parsed.companyName;
      if (parsed.companyAddress) compAddr = parsed.companyAddress;
      if (parsed.companyGstin) compGstin = parsed.companyGstin;
    } catch (e) { console.error(e); }
  }

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders');
      const sorted = (res.data || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(sorted);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, []);

  // Sync parameter search ID
  useEffect(() => {
    if (orderIdParam) {
      const fetchDetail = async () => {
        setLoadingDetail(true);
        try {
          const res = await api.get(`/orders/${orderIdParam}`);
          setSelectedOrder(res.data);
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingDetail(false);
        }
      };
      fetchDetail();
    } else {
      setSelectedOrder(null);
    }
  }, [orderIdParam]);

  // Pre-select order if navigated from Kanban with state
  useEffect(() => {
    if (location.state?.orderId && orders.length > 0) {
      const found = orders.find(o => o.id === location.state.orderId);
      if (found) {
        setSearchParams({ id: found.id });
      }
    }
  }, [orders, location.state]);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await api.patch(`/orders/${id}/status`, { status: newStatus });
      Swal.fire({
        title: 'Status Updated',
        text: `Order status changed successfully to ${newStatus}`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      fetchOrders();
      if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (e) {
      Swal.fire({
        title: 'Update Failed',
        text: e.response?.data?.error || 'Failed to update order status.',
        icon: 'error',
        confirmButtonColor: '#6366f1'
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    try {
      await api.delete(`/orders/${id}`);
      fetchOrders();
    } catch (e) { alert(e.response?.data?.error || 'Failed to delete order'); }
  };

  const compileInvoiceA4PDF = (order, companySettings) => {
    const doc = new jsPDF();

    const companyName = companySettings?.companyName || 'LEONEX SYSTEMS PRIVATE LIMITED';
    const companyAddress = companySettings?.companyAddress || 'O.T, Madras Thiruvallur High Rd, opp. Stedeford Hospital, Chennai, Tamil Nadu 600053';
    const companyGstin = companySettings?.companyGstin || '33AABCL0702C1ZG';
    const companyMobile = companySettings?.companyMobile || '+91 9360163523';

    const customerGstin = order.customer?.gstin || order.taxRegNo || '';
    const customerState = customerGstin.trim().replace(/^GSTIN-/, '').substring(0, 2);
    const companyState = companyGstin.trim().substring(0, 2);
    const isSameState = customerState === companyState || !customerState;

    doc.setFillColor(30, 27, 75);
    doc.rect(0, 0, 210, 8, 'F');
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 8, 210, 1.5, 'F');

    let currentY = 22;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(30, 27, 75);
    doc.text('TAX INVOICE', 14, currentY);

    currentY += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(companyName.toUpperCase(), 14, currentY);
    currentY += 4.5;
    
    const companyAddressLines = doc.splitTextToSize(companyAddress, 80);
    doc.text(companyAddressLines, 14, currentY);
    const companyAddressHeight = companyAddressLines.length * 4.5;
    currentY += companyAddressHeight;
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 27, 75);
    doc.text(`GSTIN: ${companyGstin}`, 14, currentY);
    currentY += 4.5;
    doc.text(`Mobile: ${companyMobile}`, 14, currentY);

    const metaBoxX = 115;
    const metaBoxWidth = 81;
    const metaBoxY = 15;
    const metaBoxHeight = 35;

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(metaBoxX, metaBoxY, metaBoxWidth, metaBoxHeight, 3, 3, 'FD');

    let mY = metaBoxY + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('INVOICE NO.', metaBoxX + 4, mY);
    doc.setTextColor(30, 27, 75);
    doc.setFontSize(9);
    doc.text(order.referenceNo || 'N/A', metaBoxX + 4, mY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('INVOICE DATE', metaBoxX + 44, mY);
    doc.setTextColor(30, 27, 75);
    doc.setFontSize(9);
    doc.text(new Date(order.createdAt).toLocaleDateString('en-GB') || 'N/A', metaBoxX + 44, mY + 4);

    mY += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('PAYMENT TERMS', metaBoxX + 4, mY);
    doc.setTextColor(30, 27, 75);
    doc.setFontSize(9);
    doc.text(order.paymentTerms || 'Not Paid', metaBoxX + 4, mY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('DELIVERY DATE', metaBoxX + 44, mY);
    doc.setTextColor(30, 27, 75);
    doc.setFontSize(9);
    doc.text(new Date(order.deliveryDate).toLocaleDateString('en-GB') || 'N/A', metaBoxX + 44, mY + 4);

    currentY = Math.max(currentY + 6, 60);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, currentY, 182, 24, 2, 2, 'D');

    let bY = currentY + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('BILLED TO (BUYER):', 18, bY);
    doc.setTextColor(30, 27, 75);
    doc.setFontSize(9.5);
    doc.text(order.customer?.name || 'Walk-in Customer', 18, bY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const delAddress = order.deliveryAddress || order.customer?.address || 'N/A';
    const customerAddressLines = doc.splitTextToSize(delAddress, 85);
    doc.text(customerAddressLines, 18, bY + 9);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 27, 75);
    doc.text(`Buyer GSTIN: ${customerGstin || 'Unregistered'}`, 115, bY + 4.5);

    currentY += 32;
    doc.setFillColor(30, 27, 75);
    doc.rect(14, currentY, 182, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('SN', 17, currentY + 5.5, { align: 'center' });
    doc.text('PRODUCT DESCRIPTION', 24, currentY + 5.5);
    doc.text('HSN CODE', 95, currentY + 5.5);
    doc.text('QTY', 120, currentY + 5.5, { align: 'right' });
    doc.text('RATE (Rs.)', 140, currentY + 5.5, { align: 'right' });
    doc.text('DISC (Rs.)', 160, currentY + 5.5, { align: 'right' });
    doc.text('TOTAL (Rs.)', 192, currentY + 5.5, { align: 'right' });

    let tY = currentY + 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 27, 75);

    let totalTaxableValue = 0;
    (order.items || []).forEach((item, index) => {
      const qty = Number(item.quantity) || 0;
      const rate = Math.round(Number(item.unitPrice) || 0);
      const disc = Math.round(Number(item.discount) || 0);
      const lineTotalVal = (rate - disc) * qty;
      totalTaxableValue += lineTotalVal;

      doc.setDrawColor(241, 245, 249);
      doc.line(14, tY + 7, 196, tY + 7);

      doc.text(String(index + 1), 17, tY + 4.5, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.text(item.product?.name || 'Leonex Product', 24, tY + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.text(item.product?.hsnCode || '21050000', 95, tY + 4.5);
      doc.text(String(qty), 120, tY + 4.5, { align: 'right' });
      doc.text(`Rs.${rate}`, 140, tY + 4.5, { align: 'right' });
      doc.text(`Rs.${disc}`, 160, tY + 4.5, { align: 'right' });
      doc.text(`Rs.${lineTotalVal}`, 192, tY + 4.5, { align: 'right' });

      tY += 7.5;
    });

    const discountVal = Number(order.discountValue || 0);
    const collectTax = !!order.collectTax;
    const freightVal = Number(order.freight || 0);
    const loadingVal = Number(order.loadingCharges || 0);
    const packingVal = Number(order.packingCharges || 0);
    const insuranceVal = Number(order.insurance || 0);
    const otherVal = Number(order.otherCharges || 0);
    const cgstVal = Number(order.cgst || 0);
    const sgstVal = Number(order.sgst || 0);
    const igstVal = Number(order.igst || 0);
    const roundedGrandTotal = Number(order.grandTotal || (totalTaxableValue + cgstVal + sgstVal + igstVal + freightVal + loadingVal + packingVal + insuranceVal + otherVal - discountVal));

    tY += 5;
    const summaryX = 115;
    const summaryWidth = 81;

    const chargeOffsetCount = 
      (freightVal > 0 ? 1 : 0) + 
      (loadingVal > 0 ? 1 : 0) + 
      (packingVal > 0 ? 1 : 0) + 
      (insuranceVal > 0 ? 1 : 0) + 
      (otherVal > 0 ? 1 : 0) + 
      (discountVal > 0 ? 1 : 0);
    const boxHeight = 25 + (collectTax ? 10 : 0) + (chargeOffsetCount * 4.5);

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.rect(summaryX, tY, summaryWidth, boxHeight, 'D');

    let sY = tY + 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Taxable Subtotal:', summaryX + 4, sY);
    doc.setTextColor(30, 27, 75);
    doc.text(`Rs.${totalTaxableValue}`, summaryX + 77, sY, { align: 'right' });

    if (discountVal > 0) {
      sY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Discount:', summaryX + 4, sY);
      doc.setTextColor(220, 38, 38);
      doc.text(`-Rs.${discountVal}`, summaryX + 77, sY, { align: 'right' });
    }

    if (collectTax) {
      if (isSameState) {
        sY += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text('CGST:', summaryX + 4, sY);
        doc.setTextColor(30, 27, 75);
        doc.text(`Rs.${Math.round(cgstVal)}`, summaryX + 77, sY, { align: 'right' });

        sY += 4.5;
        doc.setTextColor(100, 116, 139);
        doc.text('SGST:', summaryX + 4, sY);
        doc.setTextColor(30, 27, 75);
        doc.text(`Rs.${Math.round(sgstVal)}`, summaryX + 77, sY, { align: 'right' });
      } else {
        sY += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text('IGST:', summaryX + 4, sY);
        doc.setTextColor(30, 27, 75);
        doc.text(`Rs.${Math.round(igstVal)}`, summaryX + 77, sY, { align: 'right' });
      }
    }

    if (freightVal > 0) {
      sY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Freight Charges:', summaryX + 4, sY);
      doc.setTextColor(30, 27, 75);
      doc.text(`Rs.${freightVal}`, summaryX + 77, sY, { align: 'right' });
    }

    if (loadingVal > 0) {
      sY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Loading/Unloading:', summaryX + 4, sY);
      doc.setTextColor(30, 27, 75);
      doc.text(`Rs.${loadingVal}`, summaryX + 77, sY, { align: 'right' });
    }

    if (packingVal > 0) {
      sY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Packing Charges:', summaryX + 4, sY);
      doc.setTextColor(30, 27, 75);
      doc.text(`Rs.${packingVal}`, summaryX + 77, sY, { align: 'right' });
    }

    if (insuranceVal > 0) {
      sY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Insurance:', summaryX + 4, sY);
      doc.setTextColor(30, 27, 75);
      doc.text(`Rs.${insuranceVal}`, summaryX + 77, sY, { align: 'right' });
    }

    if (otherVal > 0) {
      sY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Other Charges:', summaryX + 4, sY);
      doc.setTextColor(30, 27, 75);
      doc.text(`Rs.${otherVal}`, summaryX + 77, sY, { align: 'right' });
    }

    sY += 5;
    doc.setDrawColor(226, 232, 240);
    doc.line(summaryX, sY - 1, summaryX + summaryWidth, sY - 1);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 27, 75);
    doc.text('Grand Total:', summaryX + 4, sY + 1.5);
    doc.text(`Rs.${Math.round(roundedGrandTotal)}`, summaryX + 77, sY + 1.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Page 1 of 2 - Terms & Conditions and Seal on Page 2.', 105, 286, { align: 'center' });

    doc.addPage();
    doc.setFillColor(30, 27, 75);
    doc.rect(0, 0, 210, 8, 'F');
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 8, 210, 1.5, 'F');

    let termsY = 22;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 27, 75);
    doc.text('TERMS & CONDITIONS', 14, termsY);
    doc.line(14, termsY + 2, 196, termsY + 2);

    termsY += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    
    const termsText = order.quotationNote || 'No terms specified.';
    const termsLines = doc.splitTextToSize(termsText, 182);
    doc.text(termsLines, 14, termsY);

    const sigY = 230;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 27, 75);
    doc.text(`For ${companyName.toUpperCase()}`, 145, sigY);
    
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.4);
    doc.setFillColor(209, 250, 229);
    doc.roundedRect(145, sigY + 3, 40, 14, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(4, 120, 87);
    doc.text('LEONEX VERIFIED', 165, sigY + 8.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.text('AUTHORISED SIGNATORY', 165, sigY + 13, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Page 2 of 2 - Generated via Leonex ERP.', 105, 286, { align: 'center' });

    return doc.output('blob');
  };

  const compileThermalBillPDF = (order, companySettings) => {
    const companyName = companySettings?.companyName || 'LEONEX SYSTEMS PRIVATE LIMITED';
    const companyAddress = companySettings?.companyAddress || 'O.T, Madras Thiruvallur High Rd, opp. Stedeford Hospital, Chennai, Tamil Nadu 600053';
    const companyGstin = companySettings?.companyGstin || '33AABCL0702C1ZG';
    
    const itemsCount = (order.items || []).length;
    const dynamicHeight = 90 + (itemsCount * 8); // height in mm
    
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, dynamicHeight]
    });
    
    // Thermal receipt header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 27, 75);
    doc.text('RETAIL BILL', 40, 8, { align: 'center' });
    
    doc.setFontSize(7);
    doc.text(companyName.substring(0, 34), 40, 12, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(71, 85, 105);
    const addressLines = doc.splitTextToSize(companyAddress, 70);
    doc.text(addressLines, 40, 15, { align: 'center' });
    
    let curY = 15 + (addressLines.length * 3);
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${companyGstin}`, 40, curY, { align: 'center' });
    
    curY += 4;
    doc.line(5, curY, 75, curY); // divider
    
    curY += 4;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bill No: ${order.referenceNo || 'N/A'}`, 5, curY);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-GB')}`, 45, curY);
    
    curY += 3.5;
    doc.text(`Customer: ${(order.customer?.name || 'Walk-in Customer').substring(0, 22)}`, 5, curY);
    const taxRegNo = order.customer?.gstin || order.taxRegNo;
    if (taxRegNo) {
      curY += 3.5;
      doc.text(`Buyer GSTIN: ${taxRegNo}`, 5, curY);
    }
    
    curY += 3.5;
    doc.line(5, curY, 75, curY); // divider
    
    // Table headers
    curY += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('ITEM', 5, curY);
    doc.text('QTY', 38, curY, { align: 'right' });
    doc.text('RATE', 53, curY, { align: 'right' });
    doc.text('TOTAL', 75, curY, { align: 'right' });
    
    curY += 2.5;
    doc.line(5, curY, 75, curY);
    
    curY += 4;
    doc.setFont('helvetica', 'normal');
    
    let totalTaxableValue = 0;
    (order.items || []).forEach((item) => {
      const qty = Number(item.quantity) || 0;
      const rate = Math.round(Number(item.unitPrice) || 0);
      const disc = Math.round(Number(item.discount) || 0);
      const lineTotal = (rate - disc) * qty;
      totalTaxableValue += lineTotal;
      
      const nameTrunc = (item.product?.name || 'Leonex Product').substring(0, 20);
      doc.setFont('helvetica', 'bold');
      doc.text(nameTrunc, 5, curY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(qty), 38, curY, { align: 'right' });
      doc.text(`Rs.${rate - disc}`, 53, curY, { align: 'right' });
      doc.text(`Rs.${lineTotal}`, 75, curY, { align: 'right' });
      curY += 4;
    });
    
    doc.line(5, curY - 1, 75, curY - 1);
    
    // Summary
    const discountVal = Number(order.discountValue || 0);
    const collectTax = !!order.collectTax;
    const freightVal = Number(order.freight || 0);
    const loadingVal = Number(order.loadingCharges || 0);
    const packingVal = Number(order.packingCharges || 0);
    const insuranceVal = Number(order.insurance || 0);
    const otherVal = Number(order.otherCharges || 0);
    const cgstVal = Number(order.cgst || 0);
    const sgstVal = Number(order.sgst || 0);
    const igstVal = Number(order.igst || 0);
    const roundedGrandTotal = Number(order.grandTotal || (totalTaxableValue + cgstVal + sgstVal + igstVal + freightVal + loadingVal + packingVal + insuranceVal + otherVal - discountVal));

    curY += 3;
    doc.setFontSize(6);
    doc.text('Taxable Subtotal:', 40, curY, { align: 'right' });
    doc.text(`Rs.${totalTaxableValue}`, 75, curY, { align: 'right' });
    
    if (discountVal > 0) {
      curY += 3;
      doc.text('Discount:', 40, curY, { align: 'right' });
      doc.text(`-Rs.${discountVal}`, 75, curY, { align: 'right' });
    }
    
    if (collectTax) {
      const isTamilNadu = taxRegNo?.trim().replace(/^GSTIN-/, '').substring(0, 2) === '33' || !taxRegNo;
      if (isTamilNadu) {
        curY += 3;
        doc.text('CGST (9%):', 40, curY, { align: 'right' });
        doc.text(`Rs.${Math.round(cgstVal)}`, 75, curY, { align: 'right' });
        
        curY += 3;
        doc.text('SGST (9%):', 40, curY, { align: 'right' });
        doc.text(`Rs.${Math.round(sgstVal)}`, 75, curY, { align: 'right' });
      } else {
        curY += 3;
        doc.text('IGST (18%):', 40, curY, { align: 'right' });
        doc.text(`Rs.${Math.round(igstVal)}`, 75, curY, { align: 'right' });
      }
    }
    
    const totalChg = freightVal + loadingVal + packingVal + insuranceVal + otherVal;
    if (totalChg > 0) {
      curY += 3;
      doc.text('Extra Charges:', 40, curY, { align: 'right' });
      doc.text(`Rs.${totalChg}`, 75, curY, { align: 'right' });
    }
    
    curY += 4.5;
    doc.line(40, curY - 1.5, 75, curY - 1.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('GRAND TOTAL:', 40, curY, { align: 'right' });
    doc.text(`Rs.${roundedGrandTotal}`, 75, curY, { align: 'right' });
    
    curY += 6;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.text('Thank you! Visit again.', 40, curY, { align: 'center' });
    
    return doc.output('blob');
  };

  const handlePrint = async (order) => {
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: 'Compiling Invoice PDF',
      html: '<p class="text-xs text-slate-500 mt-1">Generating printable tax receipt...</p>',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
      background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl'
      }
    });

    try {
      const taxRes = await api.get('/setup/tax');
      const taxSettings = taxRes.data;

      const orderRes = await api.get(`/orders/${order.id}`);
      const fullOrder = orderRes.data;

      const a4Blob = compileInvoiceA4PDF(fullOrder, taxSettings);
      const billBlob = compileThermalBillPDF(fullOrder, taxSettings);
      const a4Url = URL.createObjectURL(a4Blob);
      const billUrl = URL.createObjectURL(billBlob);

      setPdfUrlA4(a4Url);
      setPdfUrlBill(billUrl);
      setPdfUrl(a4Url); // Default to A4 Invoice
      setPreviewMode('invoice');
      setInvoiceData(fullOrder);
      setShowInvoiceModal(true);
      Swal.close();
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: 'Error',
        text: 'Failed to retrieve billing information or target details.',
        icon: 'error',
        confirmButtonColor: '#6366f1'
      });
    }
  };

  const handleCloseInvoiceView = () => {
    setSearchParams({});
  };

  // Reset page when search term or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const filtered = orders.filter(o => {
    const matchSearch = o.referenceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        o.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (view.type === 'create') {
    return <AddOrderPage />;
  }

  // ─────────────────────── RENDERING DETAILED SUB-PAGE VIEW ───────────────────────
  if (orderIdParam) {
    if (loadingDetail) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-sm font-semibold">Loading Invoice Record...</span>
        </div>
      );
    }

    if (!selectedOrder) {
      return (
        <div className="p-6 max-w-4xl mx-auto text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Order Record Not Found</h2>
          <Button onClick={handleCloseInvoiceView} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
            Back to Registry
          </Button>
        </div>
      );
    }

    return (
      <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto animate__animated animate__fadeIn print:p-0 print:bg-white">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 print:hidden">
          <div className="space-y-0.5">
            <button 
              onClick={handleCloseInvoiceView}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-650 dark:text-indigo-400 hover:underline mb-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Order Registry
            </button>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Tax Invoice Details
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tax details, customer billings and line item profits for {selectedOrder.referenceNo}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => handlePrint(selectedOrder)} className="bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-bold rounded-xl shadow-md h-9">
              <Printer className="w-4 h-4 mr-1.5" /> Print Invoice
            </Button>
          </div>
        </div>

        {/* Invoice Page Wrapper */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden p-6 sm:p-8 space-y-6 print:shadow-none print:rounded-none print:border-none print:bg-white print:text-slate-900">
          <div className="flex flex-col sm:flex-row justify-between border-b border-slate-205 dark:border-slate-800 pb-5 gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-indigo-650 dark:text-indigo-450 uppercase tracking-tight flex items-center gap-1.5">
                <Sparkles className="w-5.5 h-5.5 text-amber-500" /> {compName}
              </h2>
              <p className="text-xs text-slate-550 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">{compAddr}</p>
              <p className="text-xs text-slate-550 dark:text-slate-400 font-bold font-mono mt-0.5">GSTIN: {compGstin}</p>
            </div>
            <div className="text-left sm:text-right">
              <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg inline-block">TAX INVOICE</h3>
              <p className="text-sm font-mono font-black text-indigo-650 dark:text-indigo-400 mt-2">{selectedOrder.referenceNo}</p>
              <p className="text-xs text-slate-550 dark:text-slate-400 mt-0.5">Date: {new Date(selectedOrder.createdAt).toLocaleDateString('en-GB')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl text-xs border border-slate-200 dark:border-slate-800 print:bg-slate-50">
            <div className="space-y-1">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Billed To Customer</span>
              <p className="font-extrabold text-slate-800 dark:text-white text-xs">{selectedOrder.customer?.name}</p>
              {selectedOrder.customer?.phone && <p className="text-slate-500 dark:text-slate-400 font-mono">Phone: {selectedOrder.customer.phone}</p>}
              <p className="text-slate-550 dark:text-slate-400 leading-relaxed">Address: {selectedOrder.deliveryAddress || selectedOrder.customer?.address || 'N/A'}</p>
            </div>
            <div className="text-left sm:text-right space-y-1 text-xs">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Order Parameters</span>
              <p className="text-slate-700 dark:text-slate-350">Order Type: <strong className="text-slate-900 dark:text-white">{selectedOrder.type}</strong></p>
              <p className="text-slate-700 dark:text-slate-350">Payment Status: <strong className="text-indigo-605 dark:text-indigo-400">{selectedOrder.paymentTerms || 'Not Paid'}</strong></p>
              <p className="text-slate-700 dark:text-slate-355">Delivery Date: <strong className="text-slate-900 dark:text-white">{new Date(selectedOrder.deliveryDate).toLocaleDateString('en-GB')}</strong></p>
              <p className="text-slate-700 dark:text-slate-355">Status: <strong className="text-emerald-600 uppercase">{selectedOrder.status}</strong></p>
            </div>
          </div>

          {/* Invoice lines table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-650 dark:text-slate-400 text-[10px] uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-2.5 text-center w-12 font-bold">SN</th>
                  <th className="px-4 py-2.5">Item Details</th>
                  <th className="px-4 py-2.5 text-right w-16">Qty</th>
                  <th className="px-4 py-2.5 text-right w-24">Rate</th>
                  <th className="px-4 py-2.5 text-right w-20">Discount</th>
                  <th className="px-4 py-2.5 text-right w-32 text-indigo-650 dark:text-indigo-400 font-bold">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {(selectedOrder.items || []).map((item, idx) => {
                  const sub = (Number(item.unitPrice) - Number(item.discount)) * Number(item.quantity);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10">
                      <td className="px-4 py-2.5 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-805 dark:text-slate-200">
                        {item.product?.name} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">({item.product?.code})</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right font-mono">₹{Number(item.unitPrice).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">₹{Number(item.discount).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-extrabold text-slate-900 dark:text-white font-mono">
                        ₹{sub.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:flex-row justify-between pt-5 border-t border-slate-200 dark:border-slate-800 gap-5 text-xs">
            {/* Left side: GST & Terms Info */}
            <div className="flex-1 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-slate-800 dark:text-slate-200">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">GST Applicability</span>
                <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Tax Collection:</span>
                    <span className="font-bold">{selectedOrder.collectTax ? 'Apply GST (CGST + SGST / IGST)' : 'No Tax'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax Registration (GSTIN):</span>
                    <span className="font-mono font-bold">{selectedOrder.taxRegNo || 'Unregistered'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax Calculation Model:</span>
                    <span className="font-bold">{selectedOrder.taxType || 'Exclusive Tax'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Charges and Totals breakdown */}
            <div className="w-full md:w-96 space-y-2 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-350">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Invoice Charges Summary</span>
              
              <div className="flex justify-between">
                <span>Taxable Subtotal:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.totalSubtotal || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Discount:</span>
                <span className="font-mono text-rose-500 font-bold">-₹{Number(selectedOrder.discountValue || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Freight Charges (GST 18%):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.freight || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Loading & Unloading (GST 18%):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.loadingCharges || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Packing Charges (GST 18%):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.packingCharges || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Insurance (GST 18%):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.insurance || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Other Charges (GST 18%):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.otherCharges || 0).toFixed(2)}</span>
              </div>

              {selectedOrder.collectTax && (
                <>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1">
                    <span>CGST @ 9%:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.cgst || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST @ 9%:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.sgst || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IGST @ 18%:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.igst || 0).toFixed(2)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between">
                <span>TDS Deduction (₹):</span>
                <span className="font-mono text-rose-500 font-bold">-₹{Number(selectedOrder.tdsDeduction || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Round Off (₹):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">₹{Number(selectedOrder.roundOff || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-xs font-black text-indigo-650 dark:text-indigo-400 border-t border-slate-205 dark:border-slate-800 pt-2 font-semibold">
                <span>Total Invoice Amount:</span>
                <span className="font-mono text-sm text-indigo-505 font-black">₹{Number(selectedOrder.grandTotal || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {!canEdit && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-medium mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to Customer Order Registry. Hitting saves, changes, additions, or deletes are restricted.</span>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-5.5 h-5.5 text-indigo-650" />
            Customer Order Registry
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Browse quotations, check fulfillment timelines, and modify active sales orders.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              onClick={() => navigate('/orders/add')}
              className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md h-9"
            >
              <Plus className="w-4 h-4 mr-1" /> Add New Order (POS Mode)
            </Button>
          </div>
        )}
      </div>

      {/* Toolbar filters */}
      <div className="bg-slate-50/50 dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 justify-between items-center text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-405" />
            <Input
              placeholder="Search by reference no or customer name..."
              className="pl-9 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-white rounded-xl focus:ring-indigo-500 text-xs h-9"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9 font-semibold"
            >
              <option value="All">All Statuses</option>
              {Object.keys(STATUS_CONFIG).map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            className="flex items-center gap-1.5 border-slate-200 dark:border-slate-700 rounded-xl h-9 text-xs font-bold bg-white dark:bg-slate-950 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Orders Grid/Table Listing */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto text-xs animate__animated animate__fadeIn">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-450 uppercase font-bold tracking-widest border-b dark:border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Reference No</th>
                <th className="px-4 py-2.5">Customer Name</th>
                <th className="px-4 py-2.5 text-center">Type</th>
                <th className="px-4 py-2.5 text-right">Items Count</th>
                <th className="px-4 py-2.5 text-right">Subtotal Value</th>
                <th className="px-4 py-2.5 text-center">Delivery Date</th>
                <th className="px-4 py-2.5 text-center">Order Status</th>
                <th className="px-4 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">Loading customer orders...</td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">No orders matched your search criteria.</td>
                </tr>
              ) : (
                paginated.map(order => {
                  const itemsCount = (order.items || []).reduce((acc, it) => acc + Number(it.quantity || 0), 0);
                  const config = STATUS_CONFIG[order.status] || { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400', border: 'border-slate-200' };
                  return (
                    <tr key={order.id} className="dark:border-slate-800 hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                      <td className="px-4 py-2.5 font-mono font-bold text-indigo-650 dark:text-indigo-400">{order.referenceNo}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-805 dark:text-slate-200">{order.customer?.name}</td>
                      <td className="px-4 py-2.5 text-center text-slate-500 font-semibold">{order.type}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold">{itemsCount}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-black text-slate-855 dark:text-white">
                        ₹{Number(order.totalSubtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-500 font-semibold">
                        {new Date(order.deliveryDate).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <select
                          disabled={!canEdit}
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-extrabold rounded-xl border bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all h-8 cursor-pointer font-sans disabled:opacity-75 disabled:cursor-not-allowed ${config.bg} ${config.text} ${config.border}`}
                          style={{ minWidth: '150px' }}
                        >
                          <option value="Quotation" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Quotation</option>
                          <option value="Confirmed" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Confirmed</option>
                          <option value="Waiting for Production" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Waiting for Production</option>
                          <option value="In Production" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">In Production</option>
                          <option value="Ready for Shipment" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Ready for Shipment</option>
                          <option value="Delivered" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Delivered</option>
                          <option value="Cancelled" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setSearchParams({ id: order.id })}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-650 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-lg transition-colors" title="View details">
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button onClick={() => navigate(`/orders/edit/${order.id}`)}
                              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-650 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-lg transition-colors" title="Edit">
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handlePrint(order)}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 rounded-lg transition-colors" title="Print Invoice">
                            <Printer className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button onClick={() => handleDelete(order.id)}
                              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-455 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4" />
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
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} entries
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-400 font-medium order-3">
              Matched entries: {filtered.length} entries
            </div>
          </div>
        )}
      </div>

      {showInvoiceModal && invoiceData && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate__animated animate__fadeIn">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <div>
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" /> Premium Tax Invoice Preview
                </h3>
                <p className="text-[9px] text-slate-500 mt-0.5">Reference: {invoiceData.referenceNo}</p>
              </div>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Iframe View */}
            <div className="flex-1 bg-slate-950 p-5 flex flex-col md:flex-row gap-5 overflow-y-auto">
              {/* Left Column: Interactive Actions */}
              <div className="w-full md:w-64 space-y-4 shrink-0">
                {/* Format layout choice */}
                <div className="bg-slate-900 p-4 border border-slate-800 rounded-2xl space-y-2.5">
                  <span className="text-[9px] font-black text-slate-405 uppercase block tracking-wider">Choose Layout</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPdfUrl(pdfUrlA4);
                        setPreviewMode('invoice');
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-extrabold transition-all border cursor-pointer ${
                        previewMode === 'invoice' 
                          ? 'bg-indigo-650 border-indigo-500 text-white' 
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      A4 Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPdfUrl(pdfUrlBill);
                        setPreviewMode('bill');
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-extrabold transition-all border cursor-pointer ${
                        previewMode === 'bill' 
                          ? 'bg-indigo-650 border-indigo-500 text-white' 
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Thermal POS
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Receipt Controls</span>
                  
                  <Button 
                    onClick={() => {
                      const iframe = document.getElementById('invoice-print-frame');
                      if (iframe) {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();
                      }
                    }} 
                    className="w-full bg-indigo-650 hover:bg-indigo-755 text-white font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer text-xs h-9"
                  >
                    <Printer className="w-4 h-4" /> Spool Print
                  </Button>

                  <Button 
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = pdfUrl;
                      a.download = `${previewMode === 'invoice' ? 'INVOICE' : 'BILL'}-${invoiceData.referenceNo}.pdf`;
                      a.click();
                    }} 
                    variant="outline" 
                    className="w-full border-slate-800 hover:border-slate-700 text-slate-350 hover:bg-slate-800 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-xs h-9"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </Button>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2 text-[10px] text-slate-400 leading-relaxed">
                  <span className="font-extrabold text-slate-300 block uppercase tracking-wider text-[9px]">Terms & Instructions:</span>
                  <p>1. Ensure your thermal or laser print spooler is active.</p>
                  <p>2. Select <strong>A4 Invoice</strong> to include full terms and conditions on a dedicated page.</p>
                  <p>3. Select <strong>Thermal POS</strong> for a compact bill receipt excluding terms to conserve paper.</p>
                </div>
              </div>

              {/* Right Column: PDF Viewer */}
              <div className="flex-1 min-h-[450px] border border-slate-800 rounded-2xl overflow-hidden bg-slate-900 relative">
                {pdfUrl ? (
                  <iframe
                    id="invoice-print-frame"
                    src={pdfUrl}
                    className="w-full h-full border-none"
                    title="PDF Preview"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-550 gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
                    <span className="text-xs font-semibold">Compiling jsPDF Vector Elements...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
              <Button onClick={() => setShowInvoiceModal(false)} variant="outline" className="border-slate-800 text-slate-350 px-6 py-2 rounded-xl text-xs font-bold cursor-pointer h-9">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
