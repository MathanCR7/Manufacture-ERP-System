import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { FileText, Search, RefreshCw, AlertTriangle, ShieldAlert, Award, Clock, ArrowRight, X, ChevronLeft, Eye, Printer, Sparkles, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import Swal from 'sweetalert2';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { Pagination } from '@/components/ui/Pagination';
import DashboardBackButton from '@/components/ui/DashboardBackButton';
import useAuthStore from '@/app/store/authStore';

export default function SalesListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderIdParam = searchParams.get('id');
  const user = useAuthStore(s => s.user);
  const isReadOnly = user?.role === 'SUPERVISOR';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Dynamic settings
  const [companySettings, setCompanySettings] = useState(null);
  const [layoutMode, setLayoutMode] = useState('A4'); // A4 or POS
  const [activePdfUrl, setActivePdfUrl] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders');
      const list = res.data || [];
      setOrders(list.filter(o => o.type === 'Invoice' || o.type === 'Sales Order' || o.type === 'POS'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    // Load setup tax
    api.get('/setup/tax').then(res => {
      if (res.data) setCompanySettings(res.data);
    }).catch(err => console.warn('Could not load setup tax', err));
  }, []);

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

  // Reset page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // PDF compilers
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
    doc.text('ITEMS DESCRIPTION', 32, currentY + 5.5);
    doc.text('HSN', 86, currentY + 5.5);
    doc.text('QTY', 101, currentY + 5.5, { align: 'right' });
    doc.text('UNIT PRICE', 123, currentY + 5.5, { align: 'right' });
    doc.text('DISC', 143, currentY + 5.5, { align: 'right' });
    doc.text('TAX RATE', 165, currentY + 5.5, { align: 'right' });
    doc.text('AMOUNT', 191, currentY + 5.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);

    let tY = currentY + 8;
    const itemRows = order.items || [];
    itemRows.forEach((row, i) => {
      const description = row.product?.name || 'Unknown Product';
      const hsn = row.product?.hsnCode || 'N/A';
      const qty = Number(row.quantity) || 0;
      const price = Number(row.unitPrice) || 0;
      const disc = Number(row.discount) || 0;
      const amt = (price - disc) * qty;

      let taxPercent = 0;
      if (order.taxType === 'Exclusive' && companySettings?.collectTax === 'Yes') {
        taxPercent = isSameState 
          ? (Number(companySettings?.cgstRate || 9) + Number(companySettings?.sgstRate || 9))
          : Number(companySettings?.igstRate || 18);
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(14, tY + 6.5, 196, tY + 6.5);

      doc.text(`${i + 1}`, 17, tY + 4.5, { align: 'center' });
      doc.text(description.substring(0, 32), 32, tY + 4.5);
      doc.text(hsn, 86, tY + 4.5);
      doc.text(`${qty}`, 101, tY + 4.5, { align: 'right' });
      doc.text(`Rs.${price.toFixed(0)}`, 123, tY + 4.5, { align: 'right' });
      doc.text(`Rs.${disc.toFixed(0)}`, 143, tY + 4.5, { align: 'right' });
      doc.text(`${taxPercent}%`, 165, tY + 4.5, { align: 'right' });
      doc.text(`Rs.${amt.toFixed(2)}`, 191, tY + 4.5, { align: 'right' });

      tY += 7.5;
    });

    tY += 5;
    const summaryX = 115;
    const summaryWidth = 81;

    const chargeOffsetCount = 
      (Number(order.freight || 0) > 0 ? 1 : 0) + 
      (Number(order.loadingCharges || 0) > 0 ? 1 : 0) + 
      (Number(order.packingCharges || 0) > 0 ? 1 : 0) + 
      (Number(order.insurance || 0) > 0 ? 1 : 0) + 
      (Number(order.otherCharges || 0) > 0 ? 1 : 0) + 
      (Number(order.totalDiscount || 0) > 0 ? 1 : 0);
    const boxHeight = 25 + (order.totalTax > 0 ? 10 : 0) + (chargeOffsetCount * 4.5);

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.rect(summaryX, tY, summaryWidth, boxHeight, 'D');

    let sY = tY + 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Taxable Subtotal:', summaryX + 4, sY);
    doc.setTextColor(30, 27, 75);
    doc.text(`Rs.${Number(order.totalSubtotal || 0).toFixed(2)}`, summaryX + 77, sY, { align: 'right' });

    if (order.totalTax > 0) {
      if (isSameState) {
        sY += 4.5;
        doc.setTextColor(100, 116, 139);
        doc.text('CGST:', summaryX + 4, sY);
        doc.setTextColor(30, 27, 75);
        doc.text(`Rs.${Number(order.totalCGST || 0).toFixed(2)}`, summaryX + 77, sY, { align: 'right' });

        sY += 4.5;
        doc.setTextColor(100, 116, 139);
        doc.text('SGST:', summaryX + 4, sY);
        doc.setTextColor(30, 27, 75);
        doc.text(`Rs.${Number(order.totalSGST || 0).toFixed(2)}`, summaryX + 77, sY, { align: 'right' });
      } else {
        sY += 4.5;
        doc.setTextColor(100, 116, 139);
        doc.text('IGST:', summaryX + 4, sY);
        doc.setTextColor(30, 27, 75);
        doc.text(`Rs.${Number(order.totalIGST || 0).toFixed(2)}`, summaryX + 77, sY, { align: 'right' });
      }
    }

    if (Number(order.freight || 0) > 0) {
      sY += 4.5;
      doc.setTextColor(100, 116, 139);
      doc.text('Freight Charges:', summaryX + 4, sY);
      doc.setTextColor(30, 27, 75);
      doc.text(`Rs.${Number(order.freight).toFixed(2)}`, summaryX + 77, sY, { align: 'right' });
    }

    sY += 6;
    doc.setDrawColor(241, 245, 249);
    doc.line(summaryX + 2, sY - 2.5, summaryX + 79, sY - 2.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 27, 75);
    doc.text('GRAND TOTAL:', summaryX + 4, sY + 1.5);
    doc.setFontSize(11);
    doc.setTextColor(16, 185, 129);
    doc.text(`Rs.${Number(order.grandTotal || 0).toLocaleString('en-IN')}`, summaryX + 77, sY + 1.5, { align: 'right' });

    const pdfBlob = doc.output('blob');
    return pdfBlob;
  };

  const compileThermalBillPDF = (order, companySettings) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 150]
    });

    const companyName = companySettings?.companyName || 'LEONEX SYSTEMS PRIVATE LIMITED';
    const companyAddress = companySettings?.companyAddress || 'Ambattur, Chennai';
    const companyGstin = companySettings?.companyGstin || '33AABCL0702C1ZG';
    const companyMobile = companySettings?.companyMobile || '+91 9360163523';

    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(companyName.toUpperCase().substring(0, 30), 40, 10, { align: 'center' });

    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.text(companyAddress.substring(0, 48), 40, 14, { align: 'center' });
    doc.text(`GSTIN: ${companyGstin}`, 40, 18, { align: 'center' });
    doc.text(`Mobile: ${companyMobile}`, 40, 22, { align: 'center' });

    doc.line(5, 25, 75, 25);

    doc.setFontSize(7.5);
    doc.text(`Ref No: ${order.referenceNo}`, 6, 29);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-GB')}`, 6, 33);
    doc.text(`Customer: ${(order.customer?.name || 'Walk-in').substring(0, 20)}`, 6, 37);

    doc.line(5, 40, 75, 40);

    let tY = 44;
    doc.setFont('courier', 'bold');
    doc.text('Item Description   Qty   Price   Total', 6, tY);
    doc.setFont('courier', 'normal');

    tY += 4;
    const items = order.items || [];
    items.forEach((it) => {
      const name = (it.product?.name || 'Item').substring(0, 16).padEnd(16, ' ');
      const qty = String(it.quantity).padStart(5, ' ');
      const price = String(it.unitPrice).padStart(7, ' ');
      const total = String((Number(it.unitPrice) - Number(it.discount)) * Number(it.quantity)).padStart(8, ' ');
      doc.text(`${name} ${qty} ${price} ${total}`, 6, tY);
      tY += 4;
    });

    doc.line(5, tY, 75, tY);
    tY += 4;
    doc.text(`Subtotal:`.padEnd(25, ' ') + `Rs.${Number(order.totalSubtotal || 0).toFixed(2).padStart(10, ' ')}`, 6, tY);
    tY += 4;
    doc.text(`GST Tax:`.padEnd(25, ' ') + `Rs.${Number(order.totalTax || 0).toFixed(2).padStart(10, ' ')}`, 6, tY);
    tY += 4;
    doc.setFont('courier', 'bold');
    doc.text(`Grand Total:`.padEnd(25, ' ') + `Rs.${Number(order.grandTotal || 0).toFixed(0).padStart(10, ' ')}`, 6, tY);

    tY += 8;
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.text('THANK YOU FOR YOUR BUSINESS!', 40, tY, { align: 'center' });

    const pdfBlob = doc.output('blob');
    return pdfBlob;
  };

  useEffect(() => {
    if (selectedOrder) {
      const blob = layoutMode === 'A4' 
        ? compileInvoiceA4PDF(selectedOrder, companySettings) 
        : compileThermalBillPDF(selectedOrder, companySettings);
      
      if (activePdfUrl) {
        URL.revokeObjectURL(activePdfUrl);
      }
      const url = URL.createObjectURL(blob);
      setActivePdfUrl(url);
    }
  }, [selectedOrder, layoutMode, companySettings]);

  const filteredOrders = orders.filter(order => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const refMatch = order.referenceNo?.toLowerCase().includes(q);
    const nameMatch = order.customer?.name?.toLowerCase().includes(q);
    const phoneMatch = order.customer?.phone?.toLowerCase().includes(q);
    const gstinMatch = (order.customer?.gstin || order.taxRegNo)?.toLowerCase().includes(q);
    const statusMatch = order.status?.toLowerCase().includes(q);
    const typeMatch = order.type?.toLowerCase().includes(q);
    const subtotalMatch = String(order.totalSubtotal).includes(q);
    const totalMatch = String(order.grandTotal).includes(q);
    return refMatch || nameMatch || phoneMatch || gstinMatch || statusMatch || typeMatch || subtotalMatch || totalMatch;
  });

  const handleDownloadActivePdf = () => {
    if (!activePdfUrl || !selectedOrder) return;
    const a = document.createElement('a');
    a.href = activePdfUrl;
    a.download = `${layoutMode === 'A4' ? 'TAX-INVOICE' : 'POS-RECEIPT'}-${selectedOrder.referenceNo}.pdf`;
    a.click();
  };

  const handlePrintActivePdf = () => {
    const iframe = document.getElementById('sales-detail-pdf-frame');
    if (iframe) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ─────────────────────── RENDERING DETAILED INLINE VIEW (PDF FRAME) ───────────────────────
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
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Order Record Not Found</h2>
          <Button onClick={() => setSearchParams({})} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
            Back to Sales Log
          </Button>
        </div>
      );
    }

    return (
      <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300 animate__animated animate__fadeIn">
        {/* Top Header Controls Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-205 dark:border-slate-800">
          <div className="space-y-0.5">
            <button 
              onClick={() => {
                const from = searchParams.get('from');
                if (from === 'sales') navigate('/dashboard/sales');
                else if (from === 'finance') navigate('/dashboard/finance');
                else if (from === 'executive') navigate('/dashboard/executive');
                else if (from === 'inventory') navigate('/dashboard/inventory');
                else if (from === 'dashboard' || from === 'main') navigate('/dashboard');
                else setSearchParams({});
              }}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-650 dark:text-indigo-400 hover:underline mb-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> {
                searchParams.get('from') === 'sales' ? 'Back to Sales Dashboard' :
                searchParams.get('from') === 'finance' ? 'Back to Finance Dashboard' :
                searchParams.get('from') === 'executive' ? 'Back to Executive Dashboard' :
                searchParams.get('from') === 'inventory' ? 'Back to Inventory Dashboard' :
                (searchParams.get('from') === 'dashboard' || searchParams.get('from') === 'main') ? 'Back to Dashboard' :
                'Back to Sales Log'
              }
            </button>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Invoice PDF: {selectedOrder.referenceNo}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generate, print, or download vector invoice receipts for customer billings.
            </p>
          </div>

          {/* Action buttons and Layout switcher combined */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* Styled Layout Selector */}
            <div className="inline-flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setLayoutMode('A4')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  layoutMode === 'A4'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                A4 Standard
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('POS')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  layoutMode === 'POS'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Thermal POS
              </button>
            </div>

            <Button 
              onClick={handlePrintActivePdf} 
              className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md border border-slate-700 cursor-pointer h-9 px-4"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Print
            </Button>
            
            <Button 
              onClick={handleDownloadActivePdf} 
              className="bg-emerald-600 hover:bg-emerald-750 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer h-9 px-4"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download PDF
            </Button>
          </div>
        </div>

        {/* Dynamic Horizontal Premium Invoice Info Banner */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 flex flex-wrap gap-6 items-center justify-between shadow-lg text-xs">
          <div className="flex items-center gap-10 flex-wrap">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold block">Client Customer</span>
              <p className="font-extrabold text-white text-sm">{selectedOrder.customer?.name || 'Walk-in Customer'}</p>
            </div>
            
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold block">Phone</span>
              <p className="font-mono text-slate-200 text-xs font-bold">{selectedOrder.customer?.phone || 'N/A'}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold block">GSTIN</span>
              <p className="font-mono text-slate-200 text-xs font-bold">{selectedOrder.customer?.gstin || selectedOrder.taxRegNo || 'None'}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold block">Billing Model</span>
              <p className="text-slate-200 text-xs font-extrabold uppercase">{selectedOrder.taxType || 'Exclusive Tax'}</p>
            </div>
          </div>

          <div className="space-y-1 text-right">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold block">Total Due</span>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl font-black text-sm block">
              ₹{Number(selectedOrder.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Full-width Iframe PDF Viewer */}
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
              <Loader2 className="w-8 h-8 animate-spin text-indigo-505" />
              <span className="text-xs font-semibold">Compiling PDF Vector...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      <DashboardBackButton />
      {isReadOnly && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-medium mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to Sales Orders & Ledgers.</span>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-205 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <FileText className="w-5.5 h-5.5 mr-2 text-indigo-650 shrink-0" />
            Distributor Ledgers & Sales Orders
          </h1>
          <p className="text-xs text-slate-550 dark:text-slate-400 mt-0.5 font-medium">
            Monitor invoices, inspect credit risks, and review distributor outstanding balances.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto justify-end">
          <Button variant="outline" size="sm" onClick={fetchSales} disabled={loading} className="rounded-xl border-slate-202 bg-white dark:bg-slate-900 h-9 text-xs font-bold w-full sm:w-auto">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Log
          </Button>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search reference, customer, phone, status..." 
              className="pl-9 bg-white dark:bg-slate-950 border border-slate-200 text-xs h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Invoice Grid/Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-505 dark:text-slate-455 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest">
              <tr>
                <th className="px-4 py-3">Invoice Reference</th>
                <th className="px-4 py-3">Client Customer</th>
                <th className="px-4 py-3 text-center">Date</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">Loading sales records...</td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">No invoices found.</td>
                </tr>
              ) : (
                paginatedOrders.map(order => {
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-805/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                        {order.referenceNo}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-855 dark:text-white">{order.customer?.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{order.customer?.customerType || 'Retail'}</div>
                        {order.customer?.phone && (
                          <div className="text-[10px] text-slate-500 font-mono">Mobile: {order.customer.phone}</div>
                        )}
                        {(order.customer?.gstin || order.taxRegNo) && (
                          <div className="text-[10px] text-slate-500 font-mono font-bold">GSTIN: {order.customer?.gstin || order.taxRegNo}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 font-semibold">
                        {new Date(order.createdAt).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-905 dark:text-white font-mono">
                        ₹{Number(order.totalSubtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 text-3xs font-bold rounded-full border ${
                          order.status === 'Delivered'
                            ? 'bg-emerald-500/10 text-emerald-650 border-emerald-500/20'
                            : order.status === 'Ready for Shipment'
                            ? 'bg-blue-500/10 text-blue-700 border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSearchParams({ id: order.id })}
                          className="text-slate-500 hover:text-indigo-650 p-1 cursor-pointer font-bold flex items-center gap-1.5 mx-auto rounded-lg"
                        >
                          <Printer className="w-3.5 h-3.5" /> View Invoice
                        </Button>
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
            <div className="text-[11px] text-slate-555 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} entries
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-404 font-medium order-3">
              Total entries: {filteredOrders.length} records
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
