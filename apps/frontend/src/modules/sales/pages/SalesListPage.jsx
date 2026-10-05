import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/axios';
import { 
  FileText, Search, RefreshCw, AlertTriangle, ShieldAlert, Award, 
  Clock, ArrowRight, X, ChevronLeft, Eye, Printer, Sparkles, Loader2, 
  Download, ShoppingBag, CheckCircle2, User, CreditCard, Banknote, Layers, Plus,
  MessageSquare, Mail, Play, Building2, Send, Share2,
  ArrowUp, ArrowDown, ArrowUpDown, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import Swal from 'sweetalert2';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { Pagination } from '@/components/ui/Pagination';
import DashboardBackButton from '@/components/ui/DashboardBackButton';
import useAuthStore from '@/app/store/authStore';
import useCompanyStore from '@/app/store/companyStore';
import { generateA4TaxInvoice, generateThermalReceipt } from '@/utils/salesPdfGenerator';

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
  
  // Dynamic settings
  const [companySettings, setCompanySettings] = useState(null);
  const [layoutMode, setLayoutMode] = useState('A4'); // A4 or POS
  const [activePdfUrl, setActivePdfUrl] = useState(null);
  const [detailTab, setDetailTab] = useState('breakdown'); // 'breakdown' or 'pdf'

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Automatic live sync every 10 seconds without manual sync button
  useEffect(() => {
    fetchSales();
    const interval = setInterval(() => {
      fetchSales(true);
    }, 10000);

    // Load setup tax
    api.get('/setup/tax').then(res => {
      if (res.data) setCompanySettings(res.data);
    }).catch(err => console.warn('Could not load setup tax', err));

    return () => clearInterval(interval);
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
  const compileInvoiceA4PDF = (order, settings) => {
    const doc = new jsPDF();
    const activeCompany = settings || storeCompany;
    const companyName = activeCompany?.companyName || 'Company';
    const companyAddress = activeCompany?.companyAddress || 'Factory / Registered Office Address';
    const companyGstin = activeCompany?.companyGstin || '';
    const companyMobile = activeCompany?.companyMobile || '';

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

  const compileThermalBillPDF = (order, settings) => {
    const activeCompany = settings || storeCompany;
    const companyName = activeCompany?.companyName || 'Company';
    const companyAddress = activeCompany?.companyAddress || 'Factory / Registered Office Address';
    const companyGstin = activeCompany?.companyGstin || '';
    const companyMobile = activeCompany?.companyMobile || '';

    const items = order.items || [];
    const itemsCount = items.length;

    const discountVal = Number(order.discountValue || order.discount || 0);
    const collectTax = !!order.collectTax || Number(order.totalTax || order.cgst || order.sgst || 0) > 0;
    const freightVal = Number(order.freight || order.freightCharges || 0);
    const loadingVal = Number(order.loadingCharges || order.loading || 0);
    const packingVal = Number(order.packingCharges || order.packing || 0);
    const insuranceVal = Number(order.insurance || order.insuranceCharges || 0);
    const otherVal = Number(order.otherCharges || order.other || 0);
    const cgstVal = Number(order.cgst || (collectTax ? (order.totalTax ? order.totalTax / 2 : 0) : 0));
    const sgstVal = Number(order.sgst || (collectTax ? (order.totalTax ? order.totalTax / 2 : 0) : 0));
    const igstVal = Number(order.igst || 0);
    const tdsVal = Number(order.tdsDeduction || order.tds || 0);
    const roundOffVal = Number(order.roundOff || 0);

    let totalTaxableValue = Number(order.subtotal || order.totalSubtotal || 0);
    if (!totalTaxableValue) {
      items.forEach(item => {
        const qty = Number(item.quantity) || 0;
        const rate = Number(item.unitPrice) || 0;
        const disc = Number(item.discount) || 0;
        totalTaxableValue += (rate - disc) * qty;
      });
    }

    const roundedGrandTotal = Number(order.grandTotal || (totalTaxableValue + cgstVal + sgstVal + igstVal + freightVal + loadingVal + packingVal + insuranceVal + otherVal - discountVal - tdsVal + roundOffVal));

    const BILL_QUOTES = [
      "Life is like ice cream, enjoy it before it melts!",
      "Double the flavor, double the happiness.",
      "There is always room for some sweet moments.",
      "Keep cool, carry on, and eat some kulfi.",
      "Indulge in the creamy goodness of pure happiness.",
      "Crafting sweetness with premium quality standards.",
      "Happiness is a cup, a stick, or a slice of dessert.",
      "Serving smiles and superior taste since inception.",
      "Freshly prepared, carefully pasteurized, always delicious.",
      "A sweet treat for a sweeter client like you!",
      "Manufactured with state-of-the-art hygiene & love.",
      "Cool down your day with our premium kulfi pops.",
      "Sprinkled with pistachio, saffron, and joyful vibes.",
      "The secret ingredient is always high-quality care.",
      "Making your celebrations sweeter, one batch at a time.",
      "Quality is not an act, it is a daily habit.",
      "Every scoop tells a story of craftsmanship.",
      "Pure cream, natural mangoes, and rich traditions.",
      "Dessert is nature's way of making up for Mondays.",
      "Purity you can taste, standards you can trust.",
      "Kulfi: The ancient Indian art of frozen happiness.",
      "Crafted in Salem, loved across the nation.",
      "You can't buy happiness, but you can buy ice cream!",
      "Creamy texture, rich cardamom, pure delight.",
      "For the love of kulfi, made with absolute precision.",
      "Pistachio power and saffron gold in every bite.",
      "A classic recipe for a modern generation.",
      "Frozen to perfection, delivered with care.",
      "Quality raw materials make for unmatched goodness.",
      "Your trust is our pride. Have a wonderful day!"
    ];

    const randomQuote = BILL_QUOTES[Math.floor(Math.random() * BILL_QUOTES.length)];

    let activeLines = 14 + itemsCount;
    if (discountVal > 0) activeLines++;
    if (freightVal > 0) activeLines++;
    if (loadingVal > 0) activeLines++;
    if (packingVal > 0) activeLines++;
    if (insuranceVal > 0) activeLines++;
    if (otherVal > 0) activeLines++;
    if (cgstVal > 0) activeLines++;
    if (sgstVal > 0) activeLines++;
    if (igstVal > 0) activeLines++;
    if (tdsVal > 0) activeLines++;
    if (roundOffVal !== 0) activeLines++;

    let dynamicHeight = Math.max(160, 110 + (activeLines * 4));

    const doc = new jsPDF({
      unit: 'mm',
      format: [80, dynamicHeight]
    });

    // Outer Frame
    doc.setDrawColor(180, 180, 180);
    doc.line(3, 3, 77, 3);
    doc.line(3, dynamicHeight - 3, 77, dynamicHeight - 3);
    doc.line(3, 3, 3, dynamicHeight - 3);
    doc.line(77, 3, 77, dynamicHeight - 3);

    // Thermal receipt header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 27, 75);
    doc.text('RETAIL TAX INVOICE', 40, 8, { align: 'center' });

    doc.setFontSize(7);
    doc.text(companyName.toUpperCase().substring(0, 32), 40, 12, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(71, 85, 105);
    const addressLines = doc.splitTextToSize(companyAddress, 68);
    doc.text(addressLines, 40, 15, { align: 'center' });

    let curY = 15 + (addressLines.length * 2.8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 27, 75);
    doc.text(`GSTIN: ${companyGstin}`, 40, curY, { align: 'center' });

    curY += 3;
    doc.setDrawColor(220, 220, 220);
    doc.line(5, curY, 75, curY);

    curY += 3.5;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);

    const createdDate = new Date(order.createdAt || Date.now());
    const formattedDate = createdDate.toLocaleDateString('en-GB');
    const formattedTime = createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    doc.text(`Bill No: ${order.referenceNo || 'N/A'}`, 5, curY);
    doc.text(`Date: ${formattedDate}`, 48, curY);

    curY += 3;
    doc.text(`Customer: ${(order.customer?.name || 'Walk-in Customer').substring(0, 22)}`, 5, curY);
    doc.text(`Time: ${formattedTime}`, 48, curY);

    const taxRegNo = order.customer?.gstin || order.taxRegNo;
    if (taxRegNo) {
      curY += 3;
      doc.text(`Buyer GSTIN: ${taxRegNo}`, 5, curY);
    }

    curY += 3;
    doc.line(5, curY, 75, curY);

    // Table Headers
    curY += 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('ITEM', 5, curY);
    doc.text('QTY', 38, curY, { align: 'right' });
    doc.text('RATE', 53, curY, { align: 'right' });
    doc.text('TOTAL', 75, curY, { align: 'right' });

    curY += 2;
    doc.line(5, curY, 75, curY);

    curY += 3.5;
    doc.setFont('helvetica', 'normal');
    items.forEach((item) => {
      const name = (item.product?.name || item.name || 'Product').substring(0, 18);
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.unitPrice) || 0;
      const disc = Number(item.discount) || 0;
      const lineTotal = (rate - disc) * qty;

      doc.setFont('helvetica', 'bold');
      doc.text(name, 5, curY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(qty), 38, curY, { align: 'right' });
      doc.text(`Rs.${(rate - disc).toFixed(2)}`, 53, curY, { align: 'right' });
      doc.text(`Rs.${lineTotal.toFixed(2)}`, 75, curY, { align: 'right' });
      curY += 4;
    });

    curY += 1;
    doc.line(5, curY, 75, curY);

    // Summary Section Header
    curY += 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(30, 27, 75);
    doc.text('Invoice Charges Summary', 40, curY, { align: 'center' });

    curY += 2.5;
    doc.line(20, curY, 60, curY);

    // Summary Details
    curY += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(50, 50, 50);

    doc.text('Taxable Subtotal:', 48, curY, { align: 'right' });
    doc.text(`Rs.${totalTaxableValue.toFixed(2)}`, 75, curY, { align: 'right' });

    if (discountVal > 0) {
      curY += 3.2;
      doc.text('Discount:', 48, curY, { align: 'right' });
      doc.text(`-Rs.${discountVal.toFixed(2)}`, 75, curY, { align: 'right' });
    }

    if (freightVal > 0) {
      curY += 3.2;
      doc.text('Freight Charges (GST 18%):', 48, curY, { align: 'right' });
      doc.text(`Rs.${freightVal.toFixed(2)}`, 75, curY, { align: 'right' });
    }

    if (loadingVal > 0) {
      curY += 3.2;
      doc.text('Loading & Unloading (GST 18%):', 48, curY, { align: 'right' });
      doc.text(`Rs.${loadingVal.toFixed(2)}`, 75, curY, { align: 'right' });
    }

    if (packingVal > 0) {
      curY += 3.2;
      doc.text('Packing Charges (GST 18%):', 48, curY, { align: 'right' });
      doc.text(`Rs.${packingVal.toFixed(2)}`, 75, curY, { align: 'right' });
    }

    if (insuranceVal > 0) {
      curY += 3.2;
      doc.text('Insurance (GST 18%):', 48, curY, { align: 'right' });
      doc.text(`Rs.${insuranceVal.toFixed(2)}`, 75, curY, { align: 'right' });
    }

    if (otherVal > 0) {
      curY += 3.2;
      doc.text('Other Charges (GST 18%):', 48, curY, { align: 'right' });
      doc.text(`Rs.${otherVal.toFixed(2)}`, 75, curY, { align: 'right' });
    }

    if (collectTax) {
      const isTamilNadu = taxRegNo?.trim().replace(/^GSTIN-/, '').substring(0, 2) === '33' || !taxRegNo;
      if (isTamilNadu) {
        curY += 3.2;
        doc.text('CGST @ 9%:', 48, curY, { align: 'right' });
        doc.text(`Rs.${cgstVal.toFixed(2)}`, 75, curY, { align: 'right' });

        curY += 3.2;
        doc.text('SGST @ 9%:', 48, curY, { align: 'right' });
        doc.text(`Rs.${sgstVal.toFixed(2)}`, 75, curY, { align: 'right' });
      } else {
        curY += 3.2;
        doc.text('IGST @ 18%:', 48, curY, { align: 'right' });
        doc.text(`Rs.${igstVal.toFixed(2)}`, 75, curY, { align: 'right' });
      }
    }

    if (tdsVal > 0) {
      curY += 3.2;
      doc.text('TDS Deduction (Rs.):', 48, curY, { align: 'right' });
      doc.text(`-Rs.${tdsVal.toFixed(2)}`, 75, curY, { align: 'right' });
    }

    if (roundOffVal !== 0) {
      curY += 3.2;
      doc.text('Round Off (Rs.):', 48, curY, { align: 'right' });
      doc.text(`Rs.${roundOffVal.toFixed(2)}`, 75, curY, { align: 'right' });
    }

    curY += 4;
    doc.line(35, curY - 1.5, 75, curY - 1.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 27, 75);
    doc.text('Total Invoice Amount:', 48, curY, { align: 'right' });
    doc.text(`Rs.${roundedGrandTotal.toFixed(2)}`, 75, curY, { align: 'right' });

    curY += 5;
    doc.line(5, curY, 75, curY);

    // Shuffled quotes display box
    curY += 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(30, 27, 75);
    doc.text('QUOTE OF THE DAY', 40, curY, { align: 'center' });

    curY += 2.8;
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(71, 85, 105);
    const quoteLines = doc.splitTextToSize(`"${randomQuote}"`, 66);
    doc.text(quoteLines, 40, curY, { align: 'center' });

    curY += (quoteLines.length * 2.5) + 2.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`- Powered by ${companyName || 'ERP System'} -`, 40, curY, { align: 'center' });

    return doc.output('blob');
  };

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

  // Reset pagination when search, type filter, payment filter, or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, paymentStatusFilter, sortBy]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (typeFilter !== 'ALL' && order.type !== typeFilter) return false;
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

  // WhatsApp 1-Click Direct Web Dispatch
  const handleShareWhatsApp = (order) => {
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
    
    // Clean phone digits & ensure country code (default +91 for India)
    let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    const docNo = order.docNo || order.referenceNo;
    const grandTotal = Number(order.grandTotal || order.totalSubtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const dateStr = new Date(order.createdAt).toLocaleDateString('en-GB');
    const custName = order.customerName || order.customer?.name || 'Valued Client';
    const company = compName || 'Manufacturing ERP';

    const text = `🧾 *${order.type === 'Quotation' ? 'PROFORMA QUOTATION' : 'TAX INVOICE'}*
🏢 *${company}*
━━━━━━━━━━━━━━━━━━
📄 *Doc No:* ${docNo}
📅 *Date:* ${dateStr}
👤 *Client:* ${custName}
💰 *Total Amount:* ₹${grandTotal}
💳 *Payment:* ${order.paymentTerms || 'Cash'} [${order.paymentStatus || 'PAID'}]
📦 *Status:* ${order.status || 'Confirmed'}

*Terms & Conditions:*
1. Acceptance of order confirmed upon invoice issuance.
2. Prices are firm, itemized with applicable GST.
3. Defective goods must be notified within 7 days.
4. Jurisdiction: Salem, Tamil Nadu.

Thank you for choosing ${company}!`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  // Resend Invoice via Backend (Email with attached PDF + Backend WhatsApp)
  const handleResendEmail = async (order) => {
    const email = order.customer?.email;
    const confirm = await Swal.fire({
      title: 'Dispatch Invoice Document?',
      html: `<div class="text-xs text-slate-500">
        Dispatches statutory PDF invoice with Terms & Conditions to:
        <br/><strong class="text-slate-800 dark:text-slate-200 mt-1 block">${email || order.customerPhone || 'Client Contact'}</strong>
      </div>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Send',
      confirmButtonColor: '#4f46e5'
    });

    if (!confirm.isConfirmed) return;

    try {
      Swal.showLoading();
      await api.post(`/orders/${order.id}/resend`);
      Swal.fire({
        icon: 'success',
        title: 'Invoice Dispatched',
        text: 'The invoice PDF with terms & conditions has been dispatched to email and WhatsApp.',
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
          <span className="text-sm font-semibold">Loading Transaction Details...</span>
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
    const isPaid = selectedOrder.paymentStatus === 'PAID';
    const clientCustName = selectedOrder.customerName || selectedOrder.customer?.name || (isPos ? 'Walk-in Cash Customer' : 'Unregistered Client');
    const clientCustPhone = selectedOrder.customerPhone || selectedOrder.customer?.phone || 'N/A';
    const clientGstin = selectedOrder.customer?.gstin || selectedOrder.taxRegNo || 'URP (Unregistered)';

    return (
      <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300 animate__animated animate__fadeIn">
        {/* Top Header Controls Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
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
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline mb-1 cursor-pointer"
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
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                {isPos ? <ShoppingBag className="w-6 h-6 text-emerald-500" /> : <FileText className="w-6 h-6 text-indigo-500" />}
                {isPos ? 'Retail POS Transaction' : 'Tax Invoice Details'}: {selectedOrder.docNo || selectedOrder.referenceNo}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isPos 
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                  : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/30'
              }`}>
                {selectedOrder.type}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isPaid
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              }`}>
                {selectedOrder.paymentStatus || 'PAID'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Audit log, batch allocation records, payment tenders, and printable tax receipts.
            </p>
          </div>

          {/* Action buttons and View Switcher */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* View Mode Toggle: Breakdown vs Vector PDF */}
            <div className="inline-flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDetailTab('breakdown')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  detailTab === 'breakdown'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                📋 Transaction Details
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('pdf')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  detailTab === 'pdf'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                📄 Printable PDF
              </button>
            </div>

            {/* Print Slip / Print Invoice Quick Triggers */}
            {isPos ? (
              <Button 
                onClick={() => {
                  setLayoutMode('POS');
                  setDetailTab('pdf');
                  setTimeout(handlePrintActivePdf, 300);
                }} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer h-9 px-3.5 flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print 80mm Slip
              </Button>
            ) : (
              <Button 
                onClick={() => {
                  setLayoutMode('A4');
                  setDetailTab('pdf');
                  setTimeout(handlePrintActivePdf, 300);
                }} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer h-9 px-3.5 flex items-center gap-1.5"
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
              <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
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

            {/* Start Production Button */}
            {(selectedOrder.status === 'Waiting for Production' || selectedOrder.status === 'Confirmed') && (
              <Button
                type="button"
                onClick={() => handleStartProduction(selectedOrder)}
                className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer h-9 px-3 flex items-center gap-1.5"
                title="Send to Production"
              >
                <Play className="w-3.5 h-3.5" /> Start Production
              </Button>
            )}

            {/* Convert Quotation to Order */}
            {selectedOrder.type === 'Quotation' && (
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
            {(selectedOrder.type === 'Quotation' || selectedOrder.type === 'Sales Order') && (
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

        {/* Dynamic Horizontal Header Metadata Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg text-xs text-white">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold block">Customer / Party</span>
              <p className="font-bold text-white truncate text-xs">{clientCustName}</p>
              <p className="text-[11px] font-mono text-slate-400">{clientCustPhone}</p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold block">{isPos ? 'POS Terminal' : 'Document Series'}</span>
              <p className="font-bold text-white text-xs">{selectedOrder.counterId || 'COUNTER-01'}</p>
              <p className="text-[11px] font-mono text-emerald-400">Cashier: {selectedOrder.cashierName || 'Staff'}</p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold block">GSTIN / Tax ID</span>
              <p className="font-mono text-slate-300 text-xs font-semibold truncate">{clientGstin}</p>
              <p className="text-[11px] text-slate-400">{selectedOrder.taxType || 'Intra-State GST'}</p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold block">Date & Time</span>
              <p className="font-mono text-slate-200 text-xs font-semibold">{new Date(selectedOrder.createdAt).toLocaleDateString('en-GB')}</p>
              <p className="text-[11px] font-mono text-slate-400">{new Date(selectedOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold block">Payment Info</span>
              <p className="font-bold text-emerald-400 text-xs flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5" /> {selectedOrder.paymentTerms || (isPos ? 'Cash' : 'Net 30')}
              </p>
              <p className="text-[11px] text-slate-400">Status: <strong className="text-white">{selectedOrder.paymentStatus || 'PAID'}</strong></p>
            </div>

            <div className="space-y-0.5 sm:text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold block">Grand Total</span>
              <span className="text-base font-black text-emerald-400 font-mono block">
                ₹{Number(selectedOrder.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <p className="text-[10px] text-slate-400">Net Due: ₹0.00</p>
            </div>
          </div>
        </div>

        {/* ── TAB 1: INTERACTIVE DETAILS & BATCH BREAKDOWN ── */}
        {detailTab === 'breakdown' && (
          <div className="space-y-4">
            {/* Items Table Card with Batch & Expiry */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" /> Itemized Bill Lines & Allocated Batches
                  </h3>
                  <span className="text-[11px] text-slate-500">Includes FEFO batch allocation tracking, expiry dates, HSN codes, and tax rates.</span>
                </div>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2.5 py-1 rounded-lg text-xs font-mono">
                  {selectedOrder.items?.length || 0} Line Items
                </span>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-center w-12">#</th>
                      <th className="px-4 py-3">Product Name & Specifications</th>
                      <th className="px-4 py-3">Batch & Expiry Info</th>
                      <th className="px-4 py-3 text-center">HSN</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3 text-right">GST %</th>
                      <th className="px-4 py-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {(selectedOrder.items || []).map((item, idx) => {
                      const qty = Number(item.quantity) || 0;
                      const rate = Number(item.unitPrice) || 0;
                      const disc = Number(item.discount) || 0;
                      const netRate = rate - disc;
                      const lineTotal = netRate * qty;
                      const gstRateVal = Number(item.gstRate || 18);
                      const taxAmt = (lineTotal * gstRateVal) / 100;

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                              {item.productName || item.product?.name || 'Finished Product'}
                            </div>
                            {item.product?.code && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                Code: {item.product.code}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {item.batchNo ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  Batch: {item.batchNo}
                                </span>
                                {item.expiryDate && (
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    Exp: {new Date(item.expiryDate).toLocaleDateString('en-GB')}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Direct Counter Stock</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400">
                            {item.hsnCode || item.product?.hsnCode || '21050000'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 dark:text-white">
                            {qty} <span className="text-[10px] text-slate-400 font-normal">{item.uomName || item.product?.unit?.name || 'NOS'}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                            ₹{rate.toFixed(2)}
                            {disc > 0 && <span className="block text-[10px] text-rose-500 font-mono">-₹{disc.toFixed(2)}</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                            {gstRateVal}%
                            <span className="block text-[10px] text-slate-400">₹{taxAmt.toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-black text-slate-900 dark:text-white">
                            ₹{lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary & Audit Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* POS Terminal & Transaction Audit */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
                <h4 className="font-extrabold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-500" /> Payment & Counter Audit
                </h4>
                
                <div className="space-y-2 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Counter / Station ID:</span>
                    <strong className="text-slate-800 dark:text-white font-mono">{selectedOrder.counterId || 'COUNTER-01'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Cashier In-Charge:</span>
                    <strong className="text-slate-800 dark:text-white">{selectedOrder.cashierName || 'Sales Staff'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Payment Mode:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 uppercase font-bold">{selectedOrder.paymentTerms || (isPos ? 'Cash' : 'Net 30')}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Payment Status:</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      {selectedOrder.paymentStatus || 'PAID'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Amount Paid by Customer:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">
                      ₹{Number(selectedOrder.amountPaid || selectedOrder.grandTotal || 0).toFixed(2)}
                    </strong>
                  </div>
                  {selectedOrder.internalNote && (
                    <div className="py-1">
                      <span className="block text-[10px] uppercase text-slate-400 font-bold mb-0.5">Order Note:</span>
                      <p className="text-slate-700 dark:text-slate-300 italic">{selectedOrder.internalNote}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial & GST Breakdown Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                <h4 className="font-extrabold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" /> GST & Financial Calculations
                </h4>

                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>Taxable Subtotal:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">
                    ₹{Number(selectedOrder.totalSubtotal || 0).toFixed(2)}
                  </span>
                </div>

                {Number(selectedOrder.cgst) > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span>CGST (Central Tax):</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">
                      ₹{Number(selectedOrder.cgst || 0).toFixed(2)}
                    </span>
                  </div>
                )}

                {Number(selectedOrder.sgst) > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span>SGST (State Tax):</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">
                      ₹{Number(selectedOrder.sgst || 0).toFixed(2)}
                    </span>
                  </div>
                )}

                {Number(selectedOrder.igst) > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span>IGST (Integrated Tax):</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">
                      ₹{Number(selectedOrder.igst || 0).toFixed(2)}
                    </span>
                  </div>
                )}

                {Number(selectedOrder.roundOff || 0) !== 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Round-Off Adjustment:</span>
                    <span className="font-mono text-slate-500">
                      ₹{Number(selectedOrder.roundOff || 0).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between pt-2 border-t-2 border-slate-200 dark:border-slate-700 text-sm">
                  <span className="font-extrabold text-slate-900 dark:text-white">Final Net Amount:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-base">
                    ₹{Number(selectedOrder.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: VECTOR PRINTABLE PDF PREVIEW ── */}
        {detailTab === 'pdf' && (
          <div className="space-y-3">
            {/* Format Layout Selector */}
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
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <span className="text-xs font-semibold">Compiling PDF Vector...</span>
                </div>
              )}
            </div>
          </div>
        )}
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
              <FileText className="w-5.5 h-5.5 mr-2 text-indigo-600 shrink-0" />
              Sales Orders & POS Transactions Registry
            </h1>
            {/* Auto-Sync Live Badge */}
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE AUTO-SYNC</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Unified audit log for B2B Tax Invoices, Retail POS counter bills, Sales Orders, and Quotations.
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
            <FileText className="w-3.5 h-3.5" /> Sales Order
          </Button>
        </div>
      </div>

      {/* Filter Toolbar & Category Tabs */}
      <div className="flex flex-col gap-3 text-xs">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: 'All Transactions', count: orders.length, icon: Layers },
            { id: 'POS', label: '⚡ Retail POS', count: orders.filter(o => o.type === 'POS').length, icon: ShoppingBag, color: 'text-emerald-600' },
            { id: 'Invoice', label: '💼 Tax Invoices', count: orders.filter(o => o.type === 'Invoice').length, icon: FileText, color: 'text-indigo-600' },
            { id: 'Sales Order', label: '🛒 Sales Orders', count: orders.filter(o => o.type === 'Sales Order').length, icon: CheckCircle2, color: 'text-blue-600' },
            { id: 'Quotation', label: '📄 Quotations', count: orders.filter(o => o.type === 'Quotation').length, icon: Sparkles, color: 'text-purple-600' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setTypeFilter(tab.id); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                typeFilter === tab.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
              }`}
            >
              <tab.icon className={`w-3.5 h-3.5 ${tab.color || ''}`} />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                typeFilter === tab.id ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Sort Row */}
        <div className="bg-slate-50/50 dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Search Input */}
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
            {/* Payment Status Filter */}
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

            {/* Sort By Dropdown */}
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
          </div>
        </div>
      </div>

      {/* Invoice Grid/Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest text-[11px]">
              <tr>
                <th className="px-4 py-3 cursor-pointer group" onClick={() => handleToggleSort('doc')}>
                  <div className="flex items-center">
                    <span>Doc Ref / Series</span>
                    {getSortIcon('doc')}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer group" onClick={() => handleToggleSort('party')}>
                  <div className="flex items-center">
                    <span>Party & Counter Info</span>
                    {getSortIcon('party')}
                  </div>
                </th>
                <th className="px-4 py-3 text-center cursor-pointer group" onClick={() => handleToggleSort('date')}>
                  <div className="flex items-center justify-center">
                    <span>Date & Time</span>
                    {getSortIcon('date')}
                  </div>
                </th>
                <th className="px-4 py-3 text-center cursor-pointer group" onClick={() => handleToggleSort('payment')}>
                  <div className="flex items-center justify-center">
                    <span>Payment Info</span>
                    {getSortIcon('payment')}
                  </div>
                </th>
                <th className="px-4 py-3 text-right cursor-pointer group" onClick={() => handleToggleSort('amount')}>
                  <div className="flex items-center justify-end">
                    <span>Grand Total</span>
                    {getSortIcon('amount')}
                  </div>
                </th>
                <th className="px-4 py-3 text-center">Fulfillment</th>
                <th className="px-4 py-3 text-center">Actions</th>
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
                  const isSO = order.type === 'Sales Order';

                  const grandTotalVal = Number(order.grandTotal || order.totalSubtotal || 0);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                      {/* Document Ref & Type */}
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {order.docNo || order.referenceNo}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {isPos && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <ShoppingBag className="w-2.5 h-2.5" /> Retail POS
                            </span>
                          )}
                          {isInvoice && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              <FileText className="w-2.5 h-2.5" /> Tax Invoice
                            </span>
                          )}
                          {isSO && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <Layers className="w-2.5 h-2.5" /> Sales Order
                            </span>
                          )}
                          {isQuote && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              <Sparkles className="w-2.5 h-2.5" /> Quotation
                            </span>
                          )}
                          {order.sourceOrderId && (
                            <span className="text-[10px] text-slate-400 font-mono" title="Converted Order">
                              (Conv)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Party & POS Counter Info */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5 flex-wrap">
                          <span>{order.customerName || order.customer?.name || (isPos ? 'Walk-in Cash Customer' : 'Unregistered Client')}</span>
                          {(order.customer?.customerType === 'B2B' || order.customer?.customerType === 'DISTRIBUTOR' || order.customer?.customerType === 'WHOLESALE') ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              <Building2 className="w-2.5 h-2.5" /> B2B
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              <User className="w-2.5 h-2.5" /> Retail
                            </span>
                          )}
                        </div>
                        
                        {isPos ? (
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {order.counterId || 'COUNTER-01'}
                            </span>
                            <span>•</span>
                            <span>Cashier: <strong>{order.cashierName || 'Staff'}</strong></span>
                            {order.customerPhone && <span>• Ph: {order.customerPhone}</span>}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono flex-wrap">
                            {(order.customer?.gstin || order.taxRegNo) && (
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                GSTIN: {order.customer?.gstin || order.taxRegNo}
                              </span>
                            )}
                            {order.customer?.phone && <span>Ph: {order.customer.phone}</span>}
                            {order.placeOfSupply && <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded">POS: {order.placeOfSupply}</span>}
                          </div>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="px-4 py-3 text-center text-slate-500 font-semibold font-mono text-[11px]">
                        <div>{new Date(order.createdAt).toLocaleDateString('en-GB')}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Payment Info */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                            order.paymentStatus === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                              : order.paymentStatus === 'PARTIAL'
                              ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                          }`}>
                            {order.paymentStatus || (isPos ? 'PAID' : 'PENDING')}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            {order.paymentTerms || (isPos ? 'Cash' : 'Net 30')}
                          </span>
                        </div>
                      </td>

                      {/* Grand Total */}
                      <td className="px-4 py-3 text-right">
                        <div className="font-black text-slate-900 dark:text-white font-mono text-sm">
                          ₹{grandTotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {order.cgst > 0 && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Tax: ₹{(Number(order.cgst) + Number(order.sgst) + Number(order.igst)).toFixed(2)}
                          </div>
                        )}
                      </td>

                      {/* Fulfillment Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                          order.status === 'Delivered'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : order.status === 'Ready for Shipment' || order.status === 'Confirmed'
                            ? 'bg-blue-500/10 text-blue-700 border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                        }`}>
                          {order.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isPos ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setLayoutMode('POS');
                                setSearchParams({ id: order.id });
                              }}
                              className="text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 h-7 px-2 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                              title="Print 80mm POS Slip"
                            >
                              <Printer className="w-3 h-3" /> Slip
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setLayoutMode('A4');
                                setSearchParams({ id: order.id });
                              }}
                              className="text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 h-7 px-2 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                              title="Print A4 Tax Invoice"
                            >
                              <FileText className="w-3 h-3" /> A4
                            </Button>
                          )}

                          {/* WhatsApp Web Share */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleShareWhatsApp(order)}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 h-7 w-7 p-0 rounded-lg cursor-pointer"
                            title="Share Invoice on WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </Button>

                          {/* Resend to Email */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResendEmail(order)}
                            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 h-7 w-7 p-0 rounded-lg cursor-pointer"
                            title="Send Invoice to Email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </Button>

                          {/* Start Production */}
                          {(order.status === 'Waiting for Production' || order.status === 'Confirmed') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartProduction(order)}
                              className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 h-7 px-2 text-[10px] font-bold rounded-lg flex items-center gap-0.5 cursor-pointer"
                              title="Start Production Queue"
                            >
                              <Play className="w-3 h-3" /> Prod
                            </Button>
                          )}

                          {/* Convert Quotation to Order */}
                          {isQuote && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleConvertToOrder(order)}
                              className="text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800 hover:bg-blue-50 h-7 px-2 text-[10px] font-bold rounded-lg flex items-center gap-0.5 cursor-pointer"
                              title="Convert to Confirmed Order"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Order
                            </Button>
                          )}

                          {/* Convert to Tax Invoice */}
                          {(isQuote || isSO) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/sales/billing?convertFrom=${order.id}`)}
                              className="text-blue-600 hover:bg-blue-50 h-7 px-2 text-[10px] font-bold rounded-lg flex items-center gap-0.5 cursor-pointer"
                              title="Convert to Tax Invoice"
                            >
                              <ArrowRight className="w-3 h-3" /> Bill
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSearchParams({ id: order.id })}
                            className="text-slate-500 hover:text-slate-900 dark:hover:text-white h-7 w-7 p-0 rounded-lg cursor-pointer"
                            title="Inspect Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
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
