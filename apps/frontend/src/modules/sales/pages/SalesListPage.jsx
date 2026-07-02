import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { FileText, Search, RefreshCw, AlertTriangle, ShieldAlert, Award, Clock, ArrowRight, X, ChevronLeft, Eye, Printer, Sparkles, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import Swal from 'sweetalert2';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';

export default function SalesListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderIdParam = searchParams.get('id');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Dynamic settings
  const [companySettings, setCompanySettings] = useState(null);
  const [layoutMode, setLayoutMode] = useState('A4'); // A4 or POS
  const [activePdfUrl, setActivePdfUrl] = useState(null);

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
    const dynamicHeight = 90 + (itemsCount * 8);
    
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, dynamicHeight]
    });
    
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
    doc.line(5, curY, 75, curY);
    
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
    doc.line(5, curY, 75, curY);
    
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

  // Compile active PDF link dynamically
  useEffect(() => {
    if (selectedOrder) {
      const settings = companySettings || {
        companyName: compName,
        companyAddress: compAddr,
        companyGstin: compGstin
      };
      
      let blob;
      if (layoutMode === 'A4') {
        blob = compileInvoiceA4PDF(selectedOrder, settings);
      } else {
        blob = compileThermalBillPDF(selectedOrder, settings);
      }
      
      const url = URL.createObjectURL(blob);
      setActivePdfUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [selectedOrder, layoutMode, companySettings]);

  // Universal multi-parameter search mapping
  const filteredOrders = orders.filter(o => {
    const search = searchTerm.toLowerCase().trim();
    if (!search) return true;
    
    const refMatch = o.referenceNo?.toLowerCase().includes(search);
    const nameMatch = o.customer?.name?.toLowerCase().includes(search);
    const phoneMatch = o.customer?.phone?.toLowerCase().includes(search);
    const gstinMatch = (o.customer?.gstin || o.taxRegNo || '')?.toLowerCase().includes(search);
    const statusMatch = o.status?.toLowerCase().includes(search);
    const typeMatch = o.type?.toLowerCase().includes(search);
    const subtotalMatch = String(o.totalSubtotal || '').includes(search);
    const totalMatch = String(o.grandTotal || '').includes(search);

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
      <div className="p-6 max-w-6xl mx-auto space-y-5 animate__animated animate__fadeIn">
        {/* Top Header Controls Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <button 
              onClick={() => setSearchParams({})}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline mb-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Sales Log
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Invoice PDF: {selectedOrder.referenceNo}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generate, print, or download vector invoice receipts for customer billings.
            </p>
          </div>

          {/* Action buttons and Layout switcher combined */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Styled Layout Selector */}
            <div className="inline-flex bg-slate-100 dark:bg-slate-905 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setLayoutMode('A4')}
                className={`px-3 py-1.5 rounded-lg text-2xs font-extrabold transition-all cursor-pointer ${
                  layoutMode === 'A4'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-550 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                A4 Standard
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('POS')}
                className={`px-3 py-1.5 rounded-lg text-2xs font-extrabold transition-all cursor-pointer ${
                  layoutMode === 'POS'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-550 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Thermal POS
              </button>
            </div>

            <Button 
              onClick={handlePrintActivePdf} 
              className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md border border-slate-700 cursor-pointer h-9.5 px-4"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Print
            </Button>
            
            <Button 
              onClick={handleDownloadActivePdf} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer h-9.5 px-4"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download PDF
            </Button>
          </div>
        </div>

        {/* Dynamic Horizontal Premium Invoice Info Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap gap-6 items-center justify-between shadow-lg text-xs">
          <div className="flex items-center gap-10 flex-wrap">
            <div className="space-y-1">
              <span className="text-3xs uppercase tracking-widest text-slate-500 font-extrabold block">Client Customer</span>
              <p className="font-extrabold text-white text-sm">{selectedOrder.customer?.name || 'Walk-in Customer'}</p>
            </div>
            
            <div className="space-y-1">
              <span className="text-3xs uppercase tracking-widest text-slate-500 font-extrabold block">Phone</span>
              <p className="font-mono text-slate-200 text-xs font-bold">{selectedOrder.customer?.phone || 'N/A'}</p>
            </div>

            <div className="space-y-1">
              <span className="text-3xs uppercase tracking-widest text-slate-500 font-extrabold block">GSTIN</span>
              <p className="font-mono text-slate-200 text-xs font-bold">{selectedOrder.customer?.gstin || selectedOrder.taxRegNo || 'None'}</p>
            </div>

            <div className="space-y-1">
              <span className="text-3xs uppercase tracking-widest text-slate-500 font-extrabold block">Billing Model</span>
              <p className="text-slate-200 text-xs font-extrabold uppercase">{selectedOrder.taxType || 'Exclusive Tax'}</p>
            </div>
          </div>

          <div className="space-y-1 text-right">
            <span className="text-3xs uppercase tracking-widest text-slate-500 font-extrabold block">Total Due</span>
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
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs font-semibold">Compiling PDF Vector...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <FileText className="w-6 h-6 mr-2 text-indigo-655" />
            Distributor Ledgers & Sales Orders
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor invoices, inspect credit risks, and review distributor outstanding balances.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={fetchSales} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Log
          </Button>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search reference, customer, phone, status..." 
              className="pl-9 bg-white dark:bg-slate-900"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Invoice Grid/Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Invoice Reference</th>
                <th className="px-6 py-4">Client Customer</th>
                <th className="px-6 py-4 text-center">Date</th>
                <th className="px-6 py-4 text-right">Subtotal</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading sales records...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">No invoices found.</td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  return (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-white">
                        {order.referenceNo}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{order.customer?.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{order.customer?.customerType || 'Retail'}</div>
                        {order.customer?.phone && (
                          <div className="text-2xs text-slate-500 font-mono">Mobile: {order.customer.phone}</div>
                        )}
                        {(order.customer?.gstin || order.taxRegNo) && (
                          <div className="text-2xs text-slate-500 font-mono font-bold">GSTIN: {order.customer?.gstin || order.taxRegNo}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-905 dark:text-white">
                        ₹{Number(order.totalSubtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          order.status === 'Delivered'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10'
                            : order.status === 'Ready for Shipment'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSearchParams({ id: order.id })}
                          className="text-slate-550 hover:text-indigo-650 p-1 cursor-pointer font-bold flex items-center gap-1.5"
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
      </div>
    </div>
  );
}
