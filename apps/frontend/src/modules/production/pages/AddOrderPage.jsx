import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  ShoppingCart, PlusCircle, Trash2, Info, Printer, X, Check, 
  AlertTriangle, FileText, Calendar, Compass, ShieldAlert, Sparkles, 
  Layers, Search, Plus, Minus, Tag, RefreshCw, Download, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import SearchSelect from '@/components/ui/SearchSelect';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';

const DEFAULT_GTC = `1. Acceptance of Order: The vendor must confirm acceptance of the Purchase Order (PO) in writing via email or signed acknowledgment within 03 working days from the date of issue. If no written confirmation is received within this window, the Buyer reserves the right to cancel the order without any financial liability.
2. Price and Taxes: Prices stated in this PO are firm, fixed, and non-escalating. Prices are inclusive of all packing, forwarding, freight, transit insurance, and handling charges up to the delivery site. All taxes, specifically GST, must be clearly itemized on the invoice in strict accordance with CGST, SGST, and IGST rules. Any future tax benefits or Input Tax Credit (ITC) changes must be passed on to the Buyer.
3. Warranty: The Vendor warrants that all supplied goods are brand new, genuine, and free from defects in material and workmanship for 12 months from the date of acceptance. For services, the Vendor guarantees performance by qualified personnel matching industry standards. Any defective goods or substandard services identified within this period must be replaced, repaired, or re-performed by the Vendor within 7 business days at no additional cost to the Buyer.
4. Billing Instructions: Invoices must be raised as statutory Tax Invoices clearly bearing the Vendor’s valid GSTIN, correct HSN/SAC codes, and the exact Buyer PO number. Delayed submission of invoices or failure to upload invoice data to the GST portal (preventing the Buyer from claiming Input Tax Credit) will directly result in a corresponding delay in payment processing.
5. Payment Terms: Payment shall be processed via electronic transfer (NEFT/RTGS) split across two strict milestones: 50% Advance Payment: Processed within 7 working days upon written confirmation and formal acceptance of the Purchase Order (PO) by the Vendor, against the submission of a valid Proforma Invoice. 50% Final Payment: Processed within 45 days from the date of successful physical delivery of all materials at the designated site. This is subject to the submission of complete, error-free documents (Tax Invoice, Delivery Challan, and validated E-way Bill) and physical inspection and acceptance of the defect-free materials by the Buyer's site team.
6. Delivery & Liquidated Damages (LD): The delivery timeline starts immediately upon the Vendor's receipt of the 50% advance payment and must be completed strictly within 25Days. Failure to deliver on time will result in a penalty of 0.5% of the total PO value per week of delay, capped at 10%. Exceeding this 10% limit gives the Buyer the right to terminate the contract immediately and source elsewhere at the Vendor's expense.
7. Quality & Inspection: All deliverables must strictly match the technical specifications mentioned in the PO. The Buyer reserves the right to inspect materials upon arrival at the site. The Buyer can reject any defective, damaged, or substandard items. Rejected goods must be collected and removed by the Vendor from the Buyer's premises within 7 days of rejection notification at the Vendor's sole risk and expense.
8. Statutory Compliance: The Vendor shall strictly comply with all applicable Central, State, and local government laws, labor regulations (including Provident Fund, ESIC, and Minimum Wages acts), and anti-bribery policies. The use of child labor is strictly prohibited. The Vendor is solely responsible for generating accurate E-way bills for all transit movements.
9. Dispute Resolution: Any dispute arising out of this PO shall first be resolved through amicable mutual discussions. Unresolved disputes shall be referred to a sole arbitrator appointed mutually by both parties, governed by the Indian Arbitration and Conciliation Act, 1996. The venue and seat of arbitration shall be Tamil Nadu, and proceedings will be conducted in English. The courts in Salem shall have exclusive jurisdiction over this contract.`;

// 5. Quantity selector component matching the screenshot
const QuantitySelector = ({ value, onChange }) => {
  return (
    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl overflow-hidden w-full max-w-[130px] h-9.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="px-3 hover:bg-slate-800 text-slate-400 hover:text-white font-extrabold text-sm h-full flex items-center justify-center cursor-pointer transition-colors border-r border-slate-800 shrink-0"
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
          onChange(Math.max(1, parseInt(cleanVal) || 1));
        }}
        className="w-full text-center bg-transparent border-0 font-mono font-bold text-xs focus:ring-0 text-white select-all focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="px-3 hover:bg-slate-800 text-slate-400 hover:text-white font-extrabold text-sm h-full flex items-center justify-center cursor-pointer transition-colors border-l border-slate-800 shrink-0"
      >
        +
      </button>
    </div>
  );
};

import useAuthStore from '@/app/store/authStore';

export default function AddOrderPage() {
  const { id } = useParams();
  const isEditMode = !!id;
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const user = useAuthStore(s => s.user);
  const canEdit = user?.role !== 'SUPERVISOR';

  if (!canEdit) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto animate-bounce" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">View-Only Access</h2>
        <p className="text-sm text-slate-550">As a Supervisor, you have read-only access and cannot place or modify sales orders.</p>
        <Button onClick={() => navigate('/orders/list')} className="bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl cursor-pointer">
          Back to Order List
        </Button>
      </div>
    );
  }

  // Search & Catalog Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [orderType, setOrderType] = useState('Sales Order');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Live clock state variables
  const [orderDate, setOrderDate] = useState(new Date());
  const [isClockRunning, setIsClockRunning] = useState(true);

  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Not Paid');
  const [gtcText, setGtcText] = useState(DEFAULT_GTC);
  
  // Tax Configuration & Predictions
  const [collectTax, setCollectTax] = useState(true);
  const [taxRegNo, setTaxRegNo] = useState(''); // Initialized to empty, auto-populated on customer select
  const [taxType, setTaxType] = useState('Exclusive'); // Exclusive or Inclusive
  const [ourGstin, setOurGstin] = useState('33AABCL0702C1ZG'); // Default company GSTIN Tamil Nadu
  const [interstateGstRate, setInterstateGstRate] = useState(18); // Default selectable IGST rate

  // Loaded company details from /setup/tax
  const [companyInfo, setCompanyInfo] = useState({
    companyName: 'LEONEX SYSTEMS PRIVATE LIMITED',
    companyAddress: 'O.T, Madras Thiruvallur High Rd, opp. Stedeford Hospital, Krishnapuram Extension, Shobha Nagar, West Krishnapuram, Ambattur, Chennai, Tamil Nadu 600053',
    companyGstin: '33AABCL0702C1ZG',
    companyMobile: '+91 9360163523',
    collectTax: 'Yes',
    taxRegNo: '33AABCL0702C1ZG',
    taxType: 'Exclusive Tax'
  });

  // Checkout Calculations Inputs
  const [discountType, setDiscountType] = useState('Flat'); // Flat / Percent
  const [discountValue, setDiscountValue] = useState(0);
  const [tdsDeduction, setTdsDeduction] = useState(0);

  const [freight, setFreight] = useState(0);
  const [freightGst, setFreightGst] = useState(true);

  const [loadingCharges, setLoadingCharges] = useState(0);
  const [loadingGst, setLoadingGst] = useState(true);

  const [packingCharges, setPackingCharges] = useState(0);
  const [packingGst, setPackingGst] = useState(true);

  const [insurance, setInsurance] = useState(0);
  const [insuranceGst, setInsuranceGst] = useState(true);

  const [otherCharges, setOtherCharges] = useState(0);
  const [otherGst, setOtherGst] = useState(true);

  const [items, setItems] = useState([]);
  const [stockSufficiency, setStockSufficiency] = useState({});
  const [estimates, setEstimates] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // New Customer Inline Form Modal
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustForm, setNewCustForm] = useState({
    name: '',
    phone: '',
    email: '',
    customerType: 'RETAIL',
    creditLimit: '5000',
    address: '',
    gstin: '',
    note: ''
  });

  // Invoice Receipt Modal Overlay
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [createdOrderRef, setCreatedOrderRef] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfUrlA4, setPdfUrlA4] = useState(null);
  const [pdfUrlBill, setPdfUrlBill] = useState(null);
  const [previewMode, setPreviewMode] = useState('invoice'); // invoice (A4) / bill (Thermal)

  // Categories list
  const categories = ['All', ...new Set(products.map(p => p.category?.name).filter(Boolean))];

  // 3. Current running clock logic
  useEffect(() => {
    if (!isClockRunning) return;
    const timer = setInterval(() => {
      setOrderDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [isClockRunning]);

  useEffect(() => {
    const fetchMasters = async () => {
      setLoading(true);
      try {
        const custRes = await api.get('/parties/customers');
        setCustomers(custRes.data || []);

        const prodRes = await api.get('/products');
        setProducts(prodRes.data || []);

        // Fetch company details from setup/tax
        try {
          const taxSettingsRes = await api.get('/setup/tax');
          if (taxSettingsRes.data) {
            setCompanyInfo({
              companyName: taxSettingsRes.data.companyName || 'LEONEX SYSTEMS PRIVATE LIMITED',
              companyAddress: taxSettingsRes.data.companyAddress || 'O.T, Madras Thiruvallur High Rd, opp. Stedeford Hospital, Krishnapuram Extension, Shobha Nagar, West Krishnapuram, Ambattur, Chennai, Tamil Nadu 600053',
              companyGstin: taxSettingsRes.data.companyGstin || '33AABCL0702C1ZG',
              companyMobile: taxSettingsRes.data.companyMobile || '+91 9360163523',
              collectTax: taxSettingsRes.data.collectTax || 'Yes',
              taxRegNo: taxSettingsRes.data.taxRegNo || '33AABCL0702C1ZG',
              taxType: taxSettingsRes.data.taxType || 'Exclusive Tax'
            });
            setOurGstin(taxSettingsRes.data.companyGstin || '33AABCL0702C1ZG');
          }
        } catch (taxErr) {
          console.warn('Unable to load tax settings endpoints', taxErr);
        }

        if (isEditMode) {
          setIsClockRunning(false); // Stop clock when editing an existing order
          const orderRes = await api.get(`/orders/${id}`);
          const order = orderRes.data;
           setCustomerId(order.customerId);
          setOrderType(order.type);
          setDeliveryDate(new Date(order.deliveryDate).toISOString().split('T')[0]);
          setOrderDate(new Date(order.createdAt));
          setDeliveryAddress(order.deliveryAddress || '');
          setGtcText(order.quotationNote || DEFAULT_GTC);
          setInternalNote(order.internalNote || '');
          setPaymentTerms(order.paymentTerms || 'Not Paid');
          setCollectTax(!!order.collectTax);
          setTaxRegNo(order.taxRegNo || '');
          setTaxType(order.taxType || 'Exclusive');
          setDiscountValue(Number(order.discountValue || 0));
          setTdsDeduction(Number(order.tdsDeduction || 0));
          setFreight(Number(order.freight || 0));
          setFreightGst(!!order.freightGst);
          setLoadingCharges(Number(order.loadingCharges || 0));
          setLoadingGst(!!order.loadingGst);
          setPackingCharges(Number(order.packingCharges || 0));
          setPackingGst(!!order.packingGst);
          setInsurance(Number(order.insurance || 0));
          setInsuranceGst(!!order.insuranceGst);
          setOtherCharges(Number(order.otherCharges || 0));
          setOtherGst(!!order.otherGst);
          setItems(order.items.map(it => ({
            productId: it.productId,
            quantity: Number(it.quantity),
            unitPrice: Math.round(Number(it.unitPrice)), // No decimal in price
            discount: Math.round(Number(it.discount)),   // No decimal in discount
            deliveryDate: new Date(it.deliveryDate).toISOString().split('T')[0]
          })));
        } else {
          const retail = (custRes.data || []).find(c => c.name.toUpperCase().includes('RETAIL')) || (custRes.data || [])[0];
          if (retail) {
            setCustomerId(retail.id);
            setTaxRegNo(retail.gstin || ''); // auto set customer GSTIN or empty
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMasters();
  }, [id, isEditMode]);

  // 2. Fetch and display customer details automatically on select
  useEffect(() => {
    if (customerId && customers.length > 0) {
      const cust = customers.find(c => c.id === customerId);
      if (cust) {
        setTaxRegNo(cust.gstin || ''); // auto set customer GSTIN, empty if blank
        if (cust.address) setDeliveryAddress(cust.address);
      }
    }
  }, [customerId, customers]);

  // Add item click
  const handleAddProductClick = (product) => {
    const avail = Number(product.currentStock || 0);
    const existingIndex = items.findIndex(it => it.productId === product.id);
    
    if (existingIndex > -1) {
      const currentQty = items[existingIndex].quantity;
      if (currentQty + 1 > avail) {
        Swal.fire({
          title: 'Stock Limit Exceeded',
          html: `<p class="text-xs text-slate-500 mt-1">Cannot add more units. Only <strong>${avail}</strong> units of "${product.name}" are available in stock.</p>`,
          icon: 'warning',
          confirmButtonColor: '#6366f1'
        });
        return;
      }
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      setItems(updated);
    } else {
      if (avail < 1) {
        Swal.fire({
          title: 'Out of Stock',
          html: `<p class="text-xs text-slate-500 mt-1">"${product.name}" is currently out of stock.</p>`,
          icon: 'warning',
          confirmButtonColor: '#6366f1'
        });
        return;
      }
      setItems([...items, {
        productId: product.id,
        quantity: 1,
        unitPrice: Math.round(Number(product.salePrice || 0)), // 6. Enforced integer rounding
        discount: 0,
        deliveryDate: deliveryDate || new Date().toISOString().split('T')[0]
      }]);
    }
  };

  const handleRemoveItem = (index) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const handleItemChange = (index, field, val) => {
    const updated = [...items];
    const item = updated[index];
    const prod = products.find(p => p.id === item.productId);
    const avail = prod ? Number(prod.currentStock || 0) : 99999;

    if (field === 'quantity') {
      const newQty = Number(val) || 1;
      if (newQty > avail) {
        Swal.fire({
          title: 'Stock Limit Exceeded',
          html: `<p class="text-xs text-slate-500 mt-1">Cannot set quantity to ${newQty}. Only <strong>${avail}</strong> units of "${prod?.name || 'this product'}" are available in stock.</p>`,
          icon: 'warning',
          confirmButtonColor: '#6366f1'
        });
        updated[index].quantity = avail;
        setItems(updated);
        return;
      }
      updated[index].quantity = newQty;
    } else if (field === 'unitPrice' || field === 'discount') {
      updated[index][field] = Math.round(Number(val) || 0);
    } else {
      updated[index][field] = val;
    }

    if (field === 'productId') {
      const p = products.find(prodItem => prodItem.id === val);
      if (p) {
        updated[index].unitPrice = Math.round(Number(p.salePrice || 0));
        const newAvail = Number(p.currentStock || 0);
        if (updated[index].quantity > newAvail) {
          updated[index].quantity = Math.max(1, newAvail);
        }
      }
    }
    setItems(updated);
  };

  // Check stock & estimates
  useEffect(() => {
    const validItems = items.filter(it => it.productId && it.quantity > 0);
    if (validItems.length === 0) {
      setStockSufficiency({});
      setEstimates(null);
      return;
    }

    const verifyStockAndEstimates = async () => {
      try {
        const stockRes = await api.post('/orders/check-stock', {
          items: validItems.map(it => ({ productId: it.productId, quantity: Number(it.quantity) }))
        });
        const sufficiencyMap = {};
        stockRes.data.forEach(res => {
          sufficiencyMap[res.productId] = res;
        });
        setStockSufficiency(sufficiencyMap);

        const estimateRes = await api.post('/orders/estimate-cost-date', {
          items: validItems.map(it => ({ productId: it.productId, quantity: Number(it.quantity) }))
        });
        setEstimates(estimateRes.data);
      } catch (e) {
        console.error(e);
      }
    };

    const timer = setTimeout(verifyStockAndEstimates, 400);
    return () => clearTimeout(timer);
  }, [items]);

  // GST Applicability Logic
  const getTaxRates = () => {
    if (!collectTax) return { isInterState: false, cgst: 0, sgst: 0, igst: 0 };
    
    // Check if Tamil Nadu (33) state code or other matches
    const customerState = taxRegNo.trim().replace(/^GSTIN-/, '').substring(0, 2);
    const companyState = ourGstin.trim().substring(0, 2);
    
    const isSameState = customerState === companyState || !customerState;
    
    if (isSameState) {
      return {
        isInterState: false,
        cgst: 9,
        sgst: 9,
        igst: 0
      };
    } else {
      return {
        isInterState: true,
        cgst: 0,
        sgst: 0,
        igst: Number(interstateGstRate)
      };
    }
  };

  const rates = getTaxRates();

  // Unified Checkout calculations
  let taxableValue = 0;
  items.forEach(it => {
    if (!it.productId) return;
    const qty = Number(it.quantity) || 0;
    const rate = Math.round(Number(it.unitPrice) || 0);
    const disc = Math.round(Number(it.discount) || 0);
    taxableValue += (rate - disc) * qty;
  });

  const discountAmount = discountType === 'Flat' 
    ? Math.round(Number(discountValue)) 
    : Math.round(taxableValue * (Number(discountValue) / 100));

  const taxableBase = Math.max(0, taxableValue - discountAmount);

  // Additional Charges GST calculations
  const gstRateOnCharges = rates.isInterState ? (interstateGstRate / 100) : 0.18;

  const freightVal = Math.round(Number(freight) || 0);
  const freightGstVal = freightGst ? freightVal * gstRateOnCharges : 0;

  const loadingVal = Math.round(Number(loadingCharges) || 0);
  const loadingGstVal = loadingGst ? loadingVal * gstRateOnCharges : 0;

  const packingVal = Math.round(Number(packingCharges) || 0);
  const packingGstVal = packingGst ? packingVal * gstRateOnCharges : 0;

  const insuranceVal = Math.round(Number(insurance) || 0);
  const insuranceGstVal = insuranceGst ? insuranceVal * gstRateOnCharges : 0;

  const otherVal = Math.round(Number(otherCharges) || 0);
  const otherGstVal = otherGst ? otherVal * gstRateOnCharges : 0;

  // Base GST on items
  const itemsCgstVal = rates.isInterState ? 0 : taxableBase * (rates.cgst / 100);
  const itemsSgstVal = rates.isInterState ? 0 : taxableBase * (rates.sgst / 100);
  const itemsIgstVal = rates.isInterState ? taxableBase * (rates.igst / 100) : 0;

  // Combined GST breakdown
  const cgstVal = itemsCgstVal + (rates.isInterState ? 0 : (freightGstVal + loadingGstVal + packingGstVal + insuranceGstVal + otherGstVal) / 2);
  const sgstVal = itemsSgstVal + (rates.isInterState ? 0 : (freightGstVal + loadingGstVal + packingGstVal + insuranceGstVal + otherGstVal) / 2);
  const igstVal = itemsIgstVal + (rates.isInterState ? (freightGstVal + loadingGstVal + packingGstVal + insuranceGstVal + otherGstVal) : 0);

  const subtotalBeforeTax = taxableBase + freightVal + loadingVal + packingVal + insuranceVal + otherVal;
  const totalTax = cgstVal + sgstVal + igstVal;
  const grandTotalBeforeTds = subtotalBeforeTax + totalTax;
  const grandTotalFinal = Math.max(0, grandTotalBeforeTds - Math.round(Number(tdsDeduction)));
  const roundedGrandTotal = Math.round(grandTotalFinal);
  const roundOff = roundedGrandTotal - grandTotalFinal;

  const handleAddCustomerSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/parties/customers', {
        name: newCustForm.name,
        phone: newCustForm.phone,
        email: newCustForm.email || undefined,
        customerType: newCustForm.customerType,
        creditLimit: parseFloat(newCustForm.creditLimit) || 5000,
        address: newCustForm.address || undefined,
        gstin: newCustForm.gstin || undefined,
        note: newCustForm.note || undefined
      });

      Swal.fire('Customer Registered', `${newCustForm.name} registered!`, 'success');
      setShowAddCustomer(false);
      
      const custRes = await api.get('/parties/customers');
      setCustomers(custRes.data || []);
      setCustomerId(res.data.id);
      if (res.data.gstin) {
        setTaxRegNo(res.data.gstin);
      }
    } catch (err) {
      Swal.fire('Failed', err.response?.data?.message || 'Could not register customer', 'error');
    }
  };

  // Flavor icon sets for aesthetic catalog cards
  const getProductEmoji = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('choco') || lower.includes('chocolate')) return '🍫🍦';
    if (lower.includes('strawberry')) return '🍓🍧';
    if (lower.includes('mango')) return '🥭🍦';
    if (lower.includes('vanilla')) return '🍨🌼';
    return '🍦';
  };

  const compileInvoiceA4PDF = (order) => {
    const doc = new jsPDF();

    const companyName = companyInfo?.companyName || 'LEONEX SYSTEMS PRIVATE LIMITED';
    const companyAddress = companyInfo?.companyAddress || 'O.T, Madras Thiruvallur High Rd, opp. Stedeford Hospital, Chennai, Tamil Nadu 600053';
    const companyGstin = companyInfo?.companyGstin || '33AABCL0702C1ZG';
    const companyMobile = companyInfo?.companyMobile || '+91 9360163523';

    // Calculate taxes
    const customerGstin = taxRegNo || '';
    const customerState = customerGstin.trim().replace(/^GSTIN-/, '').substring(0, 2);
    const companyState = companyGstin.trim().substring(0, 2);
    const isSameState = customerState === companyState || !customerState;

    // PAGE 1: Invoice items & calculations
    doc.setFillColor(30, 27, 75); // Deep Indigo/Navy
    doc.rect(0, 0, 210, 8, 'F');
    doc.setFillColor(245, 158, 11); // Amber accent
    doc.rect(0, 8, 210, 1.5, 'F');

    // Header Layout
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

    // Right Side: Metadata Box
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
    doc.text(new Date(order.createdAt || orderDate).toLocaleDateString('en-GB') || 'N/A', metaBoxX + 44, mY + 4);

    mY += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('PAYMENT TERMS', metaBoxX + 4, mY);
    doc.setTextColor(30, 27, 75);
    doc.setFontSize(9);
    doc.text(order.paymentTerms || paymentTerms || 'Not Paid', metaBoxX + 4, mY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('DELIVERY DATE', metaBoxX + 44, mY);
    doc.setTextColor(30, 27, 75);
    doc.setFontSize(9);
    doc.text(new Date(order.deliveryDate || deliveryDate).toLocaleDateString('en-GB') || 'N/A', metaBoxX + 44, mY + 4);

    // Billed To Box
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
    const selectedCust = customers.find(c => c.id === customerId);
    doc.text(selectedCust?.name || 'Walk-in Customer', 18, bY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const delAddress = order.deliveryAddress || deliveryAddress || selectedCust?.address || 'N/A';
    const customerAddressLines = doc.splitTextToSize(delAddress, 85);
    doc.text(customerAddressLines, 18, bY + 9);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 27, 75);
    doc.text(`Buyer GSTIN: ${customerGstin || 'Unregistered'}`, 115, bY + 4.5);

    // Table Headers
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

    // Table Items
    let tY = currentY + 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 27, 75);

    items.forEach((item, index) => {
      const prod = products.find(p => p.id === item.productId);
      const qty = Number(item.quantity) || 0;
      const rate = Math.round(Number(item.unitPrice) || 0);
      const disc = Math.round(Number(item.discount) || 0);
      const lineTotalVal = (rate - disc) * qty;

      doc.setDrawColor(241, 245, 249);
      doc.line(14, tY + 7, 196, tY + 7);

      doc.text(String(index + 1), 17, tY + 4.5, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.text(prod?.name || 'Leonex Product', 24, tY + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.text(prod?.hsnCode || '21050000', 95, tY + 4.5);
      doc.text(String(qty), 120, tY + 4.5, { align: 'right' });
      doc.text(`Rs.${rate}`, 140, tY + 4.5, { align: 'right' });
      doc.text(`Rs.${disc}`, 160, tY + 4.5, { align: 'right' });
      doc.text(`Rs.${lineTotalVal}`, 192, tY + 4.5, { align: 'right' });

      tY += 7.5;
    });

    // Summary box
    tY += 5;
    const summaryX = 115;
    const summaryWidth = 81;

    const chargeOffsetCount = 
      (freightVal > 0 ? 1 : 0) + 
      (loadingVal > 0 ? 1 : 0) + 
      (packingVal > 0 ? 1 : 0) + 
      (insuranceVal > 0 ? 1 : 0) + 
      (otherVal > 0 ? 1 : 0) + 
      (discountAmount > 0 ? 1 : 0);
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
    doc.text(`Rs.${taxableValue}`, summaryX + 77, sY, { align: 'right' });

    if (discountAmount > 0) {
      sY += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Discount:', summaryX + 4, sY);
      doc.setTextColor(220, 38, 38);
      doc.text(`-Rs.${discountAmount}`, summaryX + 77, sY, { align: 'right' });
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
    doc.text(`Rs.${roundedGrandTotal}`, summaryX + 77, sY + 1.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Page 1 of 2 - Terms & Conditions and Seal on Page 2.', 105, 286, { align: 'center' });

    // PAGE 2: Terms and signatory block
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
    
    const termsText = gtcText || 'No terms specified.';
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

  const compileThermalBillPDF = (order) => {
    const companyName = companyInfo?.companyName || 'LEONEX SYSTEMS PRIVATE LIMITED';
    const companyAddress = companyInfo?.companyAddress || 'O.T, Madras High Rd, opp. Stedeford Hospital, Chennai, TN';
    const companyGstin = companyInfo?.companyGstin || '33AABCL0702C1ZG';
    
    const itemsCount = items.length;
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
    doc.text(`Date: ${new Date(order.createdAt || orderDate).toLocaleDateString('en-GB')}`, 45, curY);
    
    curY += 3.5;
    const selectedCust = customers.find(c => c.id === customerId);
    doc.text(`Customer: ${(selectedCust?.name || 'Walk-in Customer').substring(0, 22)}`, 5, curY);
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
    items.forEach((item) => {
      const prod = products.find(p => p.id === item.productId);
      const qty = Number(item.quantity) || 0;
      const rate = Math.round(Number(item.unitPrice) || 0);
      const disc = Math.round(Number(item.discount) || 0);
      const lineTotal = (rate - disc) * qty;
      
      const nameTrunc = (prod?.name || 'Leonex Product').substring(0, 20);
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
    curY += 3;
    doc.setFontSize(6);
    doc.text('Taxable Subtotal:', 40, curY, { align: 'right' });
    doc.text(`Rs.${taxableValue}`, 75, curY, { align: 'right' });
    
    if (discountAmount > 0) {
      curY += 3;
      doc.text('Discount:', 40, curY, { align: 'right' });
      doc.text(`-Rs.${discountAmount}`, 75, curY, { align: 'right' });
    }
    
    if (collectTax) {
      const isTamilNadu = taxRegNo.trim().replace(/^GSTIN-/, '').substring(0, 2) === '33' || !taxRegNo;
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

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (items.length === 0) {
      Swal.fire('Empty Order', 'Please add products to the order.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customerId,
        type: orderType,
        deliveryDate,
        createdAt: new Date(orderDate).toISOString(),
        deliveryAddress,
        quotationNote: gtcText,
        internalNote,
        paymentTerms,
        status: orderType === 'Quotation' ? 'Quotation' : 'Confirmed',
        collectTax,
        taxRegNo: taxRegNo || null,
        taxType,
        discountValue: Number(discountValue) || 0,
        tdsDeduction: Number(tdsDeduction) || 0,
        freight: Number(freight) || 0,
        freightGst,
        loadingCharges: Number(loadingCharges) || 0,
        loadingGst,
        packingCharges: Number(packingCharges) || 0,
        packingGst,
        insurance: Number(insurance) || 0,
        insuranceGst,
        otherCharges: Number(otherCharges) || 0,
        otherGst,
        cgst: Number(cgstVal) || 0,
        sgst: Number(sgstVal) || 0,
        igst: Number(igstVal) || 0,
        roundOff: Number(roundOff) || 0,
        grandTotal: Number(roundedGrandTotal) || 0,
        items: items.map(it => ({
          productId: it.productId,
          quantity: Number(it.quantity),
          unitPrice: Math.round(Number(it.unitPrice)),
          discount: Math.round(Number(it.discount)),
          deliveryDate: it.deliveryDate
        }))
      };

      const res = isEditMode 
        ? await api.put(`/orders/${id}`, payload)
        : await api.post('/orders', payload);

      const order = res.data;
      const customer = customers.find(c => c.id === customerId);
      
      const hasEmail = customer && customer.email;
      if (hasEmail) {
        Swal.fire({
          title: 'Order Confirmed',
          text: `Order reference ${order.referenceNo} generated. An invoice copy has been dispatched to client email: ${customer.email}.`,
          icon: 'success',
          timer: 3500
        });
      }

      setCreatedOrderRef(order.referenceNo);
      setInvoiceData({
        referenceNo: order.referenceNo,
        date: new Date(orderDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        dueDate: new Date(new Date(orderDate).getTime() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        customerName: customer ? customer.name : 'Walk-in Customer',
        customerPhone: customer ? customer.phone : 'N/A',
        customerAddress: deliveryAddress || (customer ? customer.address : 'N/A'),
        customerEmail: customer ? customer.email : null,
        items: items.map(it => {
          const prod = products.find(p => p.id === it.productId);
          return {
            name: prod ? prod.name : 'Unknown Product',
            code: prod ? prod.code : '',
            qty: Number(it.quantity),
            price: Math.round(Number(it.unitPrice)),
            discount: Math.round(Number(it.discount)),
            cgst: collectTax ? rates.cgst : 0,
            sgst: collectTax ? rates.sgst : 0,
            igst: collectTax ? rates.igst : 0,
            subtotal: (Math.round(Number(it.unitPrice)) - Math.round(Number(it.discount))) * Number(it.quantity)
          };
        }),
        subtotal: subtotalBeforeTax,
        totalCGST: cgstVal,
        totalSGST: sgstVal,
        totalIGST: igstVal,
        totalGST: totalTax,
        grandTotal: roundedGrandTotal,
        taxRegNo,
        taxType
      });

      const a4Blob = compileInvoiceA4PDF(order);
      const billBlob = compileThermalBillPDF(order);
      const a4Url = URL.createObjectURL(a4Blob);
      const billUrl = URL.createObjectURL(billBlob);

      setPdfUrlA4(a4Url);
      setPdfUrlBill(billUrl);
      setPdfUrl(a4Url); // Default to A4 Invoice
      setPreviewMode('invoice');
      setShowInvoiceModal(true);
    } catch (err) {
      Swal.fire('Failed', err.response?.data?.error || 'Failed to configure order specs.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        p.code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = selectedCategory === 'All' || p.category?.name === selectedCategory;
    return matchSearch && matchCategory;
  });

  const handlePrint = () => {
    window.print();
  };

  const handleModalClose = () => {
    setShowInvoiceModal(false);
    navigate('/orders/list');
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300 animate__animated animate__fadeIn text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-indigo-650 text-white rounded-2xl">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              {isEditMode ? `Edit Customer Order Spec: ${createdOrderRef}` : 'Configure Customer Sales Order & POS Creator'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Double-sided workflow billing: add recipe items using POS product click grids and compile GST invoices instantly.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate('/orders/list')}
          className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl text-xs py-2 px-4 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
        >
          Cancel
        </Button>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT 7 COLUMNS: Product Grid and Selected Items Cart */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Catalog search and category selection */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-750 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-500" /> POS Product Catalog Selection
                </h3>
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-750 dark:text-indigo-400 px-2 py-0.5 rounded font-black border border-indigo-100 dark:border-indigo-900">
                  {filteredProducts.length} Products Found
                </span>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    placeholder="Search by product name or stock code (e.g. FP-000006)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 text-2xs font-extrabold rounded-xl transition-all cursor-pointer border ${
                        selectedCategory === cat
                          ? 'bg-indigo-650 border-indigo-650 text-white shadow-lg'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* 4. Grid cards displaying product visual details with emoji background headers */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filteredProducts.map((p) => {
                    const avail = Number(p.currentStock || 0);
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleAddProductClick(p)}
                        className="bg-slate-50 dark:bg-slate-950 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-2xl border border-slate-200 dark:border-slate-800 cursor-pointer overflow-hidden transition-all hover:scale-[1.02] hover:border-indigo-500/50 dark:hover:border-indigo-500/70 shadow-sm dark:shadow-lg flex flex-col justify-between"
                      >
                        <div className="h-24 bg-gradient-to-br from-indigo-50 to-slate-100 dark:from-indigo-950 dark:to-slate-900 flex items-center justify-center text-4xl rounded-t-2xl relative overflow-hidden border-b border-slate-200 dark:border-slate-900">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span>{getProductEmoji(p.name)}</span>
                              <span className="text-[8px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black">Leonex Flavor</span>
                            </div>
                          )}
                        </div>

                        <div className="p-3 flex flex-col justify-between flex-1">
                          <div>
                            <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 block tracking-wider">{p.code}</span>
                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 line-clamp-1 mt-0.5">{p.name}</h4>
                          </div>
                          <div className="flex items-center justify-between mt-3.5 pt-2 border-t border-slate-100 dark:border-slate-900">
                            <span className="font-mono font-black text-xs text-indigo-650 dark:text-indigo-404">₹{Math.round(Number(p.salePrice || 0))}</span>
                            <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${
                              avail > 0 
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-404 border border-emerald-200 dark:border-emerald-900/50' 
                                : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-404 border border-rose-200 dark:border-rose-900/50'
                            }`}>
                              Qty: {avail}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Selected item lines cart */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-visible shadow-sm dark:shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row justify-between items-center">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-indigo-500" /> Selected Order Item Lines
                </h3>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded font-black text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                  {items.length} Lines Added
                </span>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {items.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 italic text-xs border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40">
                    No items selected yet. Click any card from the catalog above to add products.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item, idx) => {
                      const prod = products.find(p => p.id === item.productId);
                      const qty = Number(item.quantity) || 0;
                      const rate = Math.round(Number(item.unitPrice) || 0); // Enforce rounded price
                      const disc = Math.round(Number(item.discount) || 0);   // Enforce rounded discount

                      const lineSubtotal = (rate - disc) * qty;
                      const lineCost = prod ? Number(prod.totalCost || 0) * qty : 0;
                      const lineProfit = lineSubtotal - lineCost;
                      const sufficiency = stockSufficiency[item.productId];

                      return (
                        <div key={idx} className="relative p-4 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                          <div className="flex justify-between items-center gap-3">
                            <div className="flex items-center gap-2.5 flex-1">
                              <span className="flex items-center justify-center w-5.5 h-5.5 rounded-lg bg-indigo-550/10 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-400 font-extrabold text-2xs border border-indigo-200 dark:border-indigo-900">
                                {idx + 1}
                              </span>
                              <div>
                                <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                                  {prod?.name || 'Loading...'} 
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal font-sans ml-1">({prod?.code})</span>
                                </h4>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-rose-650 dark:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg p-1 h-7 cursor-pointer shrink-0"
                              onClick={() => handleRemoveItem(idx)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          {/* Inputs Row with Component Quantity Selector */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase block">Quantity</label>
                              <QuantitySelector
                                value={item.quantity}
                                onChange={(val) => handleItemChange(idx, 'quantity', val)}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block">Unit Price (₹)</label>
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                                className="font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-9.5 rounded-xl text-slate-900 dark:text-white"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block">Discount (₹)</label>
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                value={item.discount}
                                onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                                className="font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-9.5 rounded-xl text-slate-900 dark:text-white"
                              />
                            </div>
                          </div>

                          {/* Line Status and calculations summary */}
                          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-900 gap-2 text-[10px] font-mono">
                            <div className="flex items-center gap-1.5">
                              <DatePicker
                                value={item.deliveryDate ? new Date(item.deliveryDate) : null}
                                onChange={(date) => handleItemChange(idx, 'deliveryDate', date ? date.toISOString().split('T')[0] : '')}
                                modalTitle="Line Delivery Date"
                                placeholder="Select Date"
                                className="space-y-0"
                                triggerClassName="h-7 text-[10px] p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                              />
                              {sufficiency ? (
                                <span className={`px-2 py-0.5 text-[8px] font-black rounded uppercase border ${
                                  sufficiency.status === 'Sufficient'
                                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-404 border border-emerald-200 dark:border-emerald-900/50'
                                    : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-404 border border-rose-200 dark:border-rose-900/50'
                                }`}>
                                  {sufficiency.status === 'Sufficient' ? 'In Stock' : `Short: ${sufficiency.shortage} (Backorder Allowed)`}
                                </span>
                              ) : (
                                <span className="text-slate-500 font-bold text-[9px]">Checking...</span>
                              )}
                            </div>
                            <div className="flex gap-4">
                              <div>
                                <span className="text-slate-500 text-[8px] uppercase block text-right">Subtotal</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">₹{lineSubtotal}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 text-[8px] uppercase block text-right">Est. Profit</span>
                                <span className={`font-bold ${lineProfit >= 0 ? 'text-emerald-650 dark:text-emerald-400' : 'text-rose-650 dark:text-rose-450'}`}>
                                  ₹{lineProfit.toFixed(0)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT 5 COLUMNS: Customer Details & Checkout summary calculation breakdown panel */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Customer Credentials */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl rounded-2xl overflow-visible">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-indigo-500" /> Order Parameters & Customer Info
                </h3>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                
                {/* Customer name selector & Inline adder */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Customer Name *</label>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomer(true)}
                      className="text-2xs font-extrabold text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Quick Add Customer
                    </button>
                  </div>
                  <SearchSelect
                    value={customerId}
                    onChange={setCustomerId}
                    options={customers.map(c => ({
                      value: c.id,
                      label: c.name,
                      subLabel: c.phone || null
                    }))}
                    placeholder="Select Customer..."
                    searchPlaceholder="Search by name/phone..."
                    required
                    triggerClassName="h-10 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block uppercase">Order Type</label>
                    <SearchSelect
                      value={orderType}
                      onChange={setOrderType}
                      options={[
                        { value: 'Sales Order', label: 'Sales Order' },
                        { value: 'Quotation', label: 'Quotation' },
                        { value: 'Invoice', label: 'Invoice' }
                      ]}
                      showSearch={false}
                      placeholder="Select Type..."
                      required
                      triggerClassName="h-10 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block uppercase">Payment Terms</label>
                    <SearchSelect
                      value={paymentTerms}
                      onChange={setPaymentTerms}
                      options={[
                        { value: 'Paid', label: 'Paid' },
                        { value: 'Advance Payment', label: 'Advance Payment' },
                        { value: 'Not Paid', label: 'Not Paid' }
                      ]}
                      showSearch={false}
                      placeholder="Payment Option..."
                      required
                      triggerClassName={`h-10 text-xs font-bold border rounded-xl transition-all ${
                        paymentTerms === 'Paid'
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
                          : paymentTerms === 'Advance Payment'
                          ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-404 border-amber-200 dark:border-amber-900/50'
                          : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-404 border-rose-200 dark:border-rose-900/50'
                      }`}
                    />
                  </div>
                </div>

                {/* 3. Live clock running order date picker */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-400 block uppercase">Order Date</label>
                      <button
                        type="button"
                        onClick={() => setIsClockRunning(!isClockRunning)}
                        className={`text-[8px] px-1.5 py-0.5 rounded font-black transition-all ${
                          isClockRunning 
                            ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 animate-pulse' 
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-500'
                        }`}
                        title={isClockRunning ? 'Click to freeze clock' : 'Click to start live timer'}
                      >
                        {isClockRunning ? 'LIVE CLOCK' : 'FROZEN'}
                      </button>
                    </div>
                    <DatePicker
                      required
                      showTime
                      value={orderDate}
                      onChange={(date) => {
                        setIsClockRunning(false); // Stop clock when date is manually adjusted
                        setOrderDate(date || new Date());
                      }}
                      modalTitle="Select Order Timestamp"
                      placeholder="Select date"
                      className="space-y-0"
                      triggerClassName="h-10 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white w-full"
                    />
                  </div>

                  <DatePicker
                    label="Required Delivery Date *"
                    required
                    value={deliveryDate ? new Date(deliveryDate) : null}
                    onChange={(date) => setDeliveryDate(date ? date.toISOString().split('T')[0] : '')}
                    modalTitle="Select Delivery Date"
                    placeholder="Select date"
                    className="space-y-1"
                    labelClassName="text-[10px] font-bold text-slate-400 block uppercase"
                    triggerClassName="h-10 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white w-full rounded-xl"
                  />
                </div>

                {/* 2. Customer GSTIN auto fetched from select */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 block uppercase">Customer GSTIN No</label>
                  <Input
                    placeholder="GSTIN No (Auto-fetched from customer)"
                    value={taxRegNo}
                    onChange={(e) => setTaxRegNo(e.target.value.toUpperCase())}
                    className="h-10 text-xs font-mono font-bold uppercase tracking-wider bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 block uppercase">Delivery / Shipping Address</label>
                  <Input
                    placeholder="Specify destination address if separate..."
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="h-10 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 block uppercase">Internal Production Notes</label>
                  <Input
                    placeholder="Notes for logistics or lab QC check teams..."
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    className="h-10 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                {/* GST Settings Predictor */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between items-center gap-2 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 block uppercase px-1">Collect Tax (GST)</span>
                    <button
                      type="button"
                      onClick={() => setCollectTax(!collectTax)}
                      className={`px-3 py-1 text-2xs font-extrabold rounded-lg transition-all cursor-pointer ${
                        collectTax ? 'bg-indigo-650 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-405'
                      }`}
                    >
                      {collectTax ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>

                  {collectTax && (
                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-500 dark:text-slate-400 uppercase text-[9px]">Supply Target:</span>
                        <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-3xs uppercase">
                          {rates.isInterState ? '🇮🇳 Inter-State (IGST)' : '🏢 Intra-State (CGST + SGST)'}
                        </span>
                      </div>
                      {rates.isInterState ? (
                        <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 dark:border-slate-900">
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase">IGST Rate:</span>
                          <select
                            value={interstateGstRate}
                            onChange={(e) => setInterstateGstRate(Number(e.target.value))}
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 font-bold font-mono text-2xs focus:outline-none text-slate-900 dark:text-white"
                          >
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 text-center font-semibold pt-1 border-t border-slate-200 dark:border-slate-900">
                          Tamil Nadu automatic calculation: 9% CGST + 9% SGST
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-[9px] text-slate-500 dark:text-slate-400 text-center font-bold uppercase tracking-wider">
                    Company GSTIN: <span className="text-slate-700 dark:text-slate-300 font-mono ml-0.5">{ourGstin}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Calculations Breakdown Sidebar Panel */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-305 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-emerald-500" /> Quotation Tax & Charges Ledger
                </h3>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                
                {/* GST Applicability Switch */}
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-2xs">GST Applicability</span>
                  <label className="flex items-center gap-1.5 text-3xs font-extrabold cursor-pointer text-slate-700 dark:text-slate-300">
                    <input 
                      type="checkbox" 
                      checked={collectTax} 
                      onChange={() => setCollectTax(!collectTax)}
                      className="rounded border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 accent-indigo-600 w-3.5 h-3.5"
                    />
                    Apply GST (CGST + SGST)
                  </label>
                </div>

                {/* Discount type flat / percent */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block">Discount</label>
                  <div className="flex gap-2">
                    <div className="flex bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-0.5 overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => setDiscountType('Flat')}
                        className={`px-3 py-1.5 text-3xs font-extrabold rounded-lg transition-all ${
                          discountType === 'Flat' ? 'bg-indigo-650 text-white' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Flat
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('Percent')}
                        className={`px-3 py-1.5 text-3xs font-extrabold rounded-lg transition-all ${
                          discountType === 'Percent' ? 'bg-indigo-650 text-white' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        %
                      </button>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white h-9.5 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Charge lines (6. Enforced rounded pricing) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Freight (₹)</label>
                      <label className="text-[8px] font-bold text-slate-500 uppercase flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={freightGst} onChange={() => setFreightGst(!freightGst)} className="accent-indigo-600 w-3 h-3 rounded" />
                        GST 18%
                      </label>
                    </div>
                    <Input type="number" step="1" value={freight} onChange={(e) => setFreight(Math.round(Number(e.target.value)))} className="bg-slate-950 border-slate-800 text-xs text-white h-8.5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Loading & Unloading (₹)</label>
                      <label className="text-[8px] font-bold text-slate-500 uppercase flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={loadingGst} onChange={() => setLoadingGst(!loadingGst)} className="accent-indigo-600 w-3 h-3 rounded" />
                        GST 18%
                      </label>
                    </div>
                    <Input type="number" step="1" value={loadingCharges} onChange={(e) => setLoadingCharges(Math.round(Number(e.target.value)))} className="bg-slate-950 border-slate-800 text-xs text-white h-8.5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Packing Charges (₹)</label>
                      <label className="text-[8px] font-bold text-slate-500 uppercase flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={packingGst} onChange={() => setPackingGst(!packingGst)} className="accent-indigo-600 w-3 h-3 rounded" />
                        GST 18%
                      </label>
                    </div>
                    <Input type="number" step="1" value={packingCharges} onChange={(e) => setPackingCharges(Math.round(Number(e.target.value)))} className="bg-slate-950 border-slate-800 text-xs text-white h-8.5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Insurance (₹)</label>
                      <label className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={insuranceGst} onChange={() => setInsuranceGst(!insuranceGst)} className="accent-indigo-600 w-3 h-3 rounded" />
                        GST 18%
                      </label>
                    </div>
                    <Input type="number" step="1" value={insurance} onChange={(e) => setInsurance(Math.round(Number(e.target.value)))} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white h-8.5" />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Other Charges (₹)</label>
                      <label className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={otherGst} onChange={() => setOtherGst(!otherGst)} className="accent-indigo-600 w-3 h-3 rounded" />
                        GST 18%
                      </label>
                    </div>
                    <Input type="number" step="1" value={otherCharges} onChange={(e) => setOtherCharges(Math.round(Number(e.target.value)))} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white h-8.5" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5 pt-2 border-t border-slate-200 dark:border-slate-900">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">TDS Deduction (₹)</label>
                    <Input type="number" step="1" min="0" value={tdsDeduction} onChange={(e) => setTdsDeduction(Math.round(Number(e.target.value)))} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white h-8.5" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">Round Off (₹)</label>
                    <div className="h-8.5 flex items-center justify-center font-mono font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
                      {roundOff.toFixed(0)}
                    </div>
                  </div>
                </div>

                {/* Right Calculations Panel Box */}
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-semibold leading-relaxed">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Taxable Value:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">₹{taxableValue}</span>
                  </div>
                  {collectTax && (
                    <>
                      {rates.isInterState ? (
                        <div className="flex justify-between text-slate-500 dark:text-slate-400">
                          <span>IGST @ {interstateGstRate}%:</span>
                          <span className="font-mono text-slate-800 dark:text-slate-200">₹{igstVal.toFixed(0)}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between text-slate-500 dark:text-slate-400">
                            <span>CGST @ 9%:</span>
                            <span className="font-mono text-slate-800 dark:text-slate-200">₹{cgstVal.toFixed(0)}</span>
                          </div>
                          <div className="flex justify-between text-slate-500 dark:text-slate-400">
                            <span>SGST @ 9%:</span>
                            <span className="font-mono text-slate-800 dark:text-slate-200">₹{sgstVal.toFixed(0)}</span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {freightVal > 0 && (
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Freight:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">₹{freightVal}</span>
                    </div>
                  )}
                  {loadingVal > 0 && (
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Loading & Unloading:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">₹{loadingVal}</span>
                    </div>
                  )}
                  {packingVal > 0 && (
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Packing Charges:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">₹{packingVal}</span>
                    </div>
                  )}
                  {insuranceVal > 0 && (
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Insurance:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">₹{insuranceVal}</span>
                    </div>
                  )}
                  {otherVal > 0 && (
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Other Charges:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">₹{otherVal}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-rose-650 dark:text-rose-404">
                      <span>Discount:</span>
                      <span className="font-mono text-rose-650 dark:text-rose-404">-₹{discountAmount}</span>
                    </div>
                  )}
                  {Number(tdsDeduction) > 0 && (
                    <div className="flex justify-between text-amber-600 dark:text-amber-404">
                      <span>TDS Deduction:</span>
                      <span className="font-mono text-amber-650 dark:text-amber-404">-₹{Math.round(Number(tdsDeduction))}</span>
                    </div>
                  )}
                  {Math.abs(roundOff) > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Round Off:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{roundOff >= 0 ? '+' : ''}{roundOff.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-extrabold text-indigo-650 dark:text-indigo-404 border-t border-slate-200 dark:border-slate-900 pt-2">
                    <span className="uppercase">Quotation Total (Rounded):</span>
                    <span className="font-mono text-base font-black">₹{roundedGrandTotal}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* GENERAL TERMS & CONDITIONS (GTC) Textarea */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl rounded-2xl overflow-hidden max-w-full">
          <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-500" /> General Terms & Conditions (GTC)
            </h3>
          </CardHeader>
          <CardContent className="pt-4">
            <textarea
              value={gtcText}
              onChange={(e) => setGtcText(e.target.value)}
              className="w-full h-44 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl p-3 text-xs leading-normal font-mono focus:outline-none focus:border-indigo-500"
              placeholder="Provide quotations general terms conditions here..."
            />
          </CardContent>
        </Card>

        {/* 1. Main Action Button: Placed BELOW the GTC text card and centered */}
        <div className="flex justify-center pt-4 pb-8">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || items.length === 0 || !customerId}
            className="w-full max-w-md bg-indigo-650 hover:bg-indigo-750 text-white font-black py-4 h-14 rounded-2xl shadow-2xl transition-all cursor-pointer flex items-center justify-center text-sm gap-2 border border-indigo-500/50 hover:scale-[1.01]"
          >
            {submitting ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            {submitting ? 'Submitting Order Specs...' : isEditMode ? 'Save Order Modifications' : 'Create Order & Print Receipt'}
          </Button>
        </div>
      </form>

      {/* Inline Customer Registration Modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate__animated animate__fadeIn">
          <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 w-full max-w-md rounded-2xl shadow-md dark:shadow-2xl p-6 relative border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setShowAddCustomer(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider mb-4">Quick Add Customer</h3>
            <form onSubmit={handleAddCustomerSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Customer Name *</label>
                <Input
                  required
                  placeholder="Enter name"
                  value={newCustForm.name}
                  onChange={(e) => setNewCustForm({...newCustForm, name: e.target.value})}
                  className="h-9 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Phone *</label>
                  <Input
                    required
                    placeholder="Enter phone"
                    value={newCustForm.phone}
                    onChange={(e) => setNewCustForm({...newCustForm, phone: e.target.value})}
                    className="h-9 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Customer GSTIN</label>
                  <Input
                    placeholder="e.g. 33AABCL0702C1ZG"
                    value={newCustForm.gstin}
                    onChange={(e) => setNewCustForm({...newCustForm, gstin: e.target.value.toUpperCase()})}
                    className="h-9 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Email Address</label>
                  <Input
                    placeholder="Enter email"
                    type="email"
                    value={newCustForm.email}
                    onChange={(e) => setNewCustForm({...newCustForm, email: e.target.value})}
                    className="h-9 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Customer Type</label>
                  <select
                    value={newCustForm.customerType}
                    onChange={(e) => setNewCustForm({...newCustForm, customerType: e.target.value})}
                    className="w-full h-9 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 text-xs focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="RETAIL">Retail</option>
                    <option value="DISTRIBUTOR">Distributor</option>
                    <option value="WHOLESALER">Wholesaler</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Billing / Delivery Address</label>
                <Input
                  placeholder="Billing address"
                  value={newCustForm.address}
                  onChange={(e) => setNewCustForm({...newCustForm, address: e.target.value})}
                  className="h-9 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <Button type="submit" className="w-full bg-indigo-655 hover:bg-indigo-755 text-white font-extrabold h-10 rounded-xl cursor-pointer">
                Save & Select Customer
              </Button>
            </form>
          </div>
        </div>
      )}
      {showInvoiceModal && invoiceData && (
        <div className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate__animated animate__fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 w-full max-w-5xl rounded-3xl shadow-lg dark:shadow-2xl overflow-hidden flex flex-col h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" /> Premium Tax Invoice Preview
                </h3>
                <p className="text-3xs text-slate-500 dark:text-slate-400 mt-0.5">Reference: {invoiceData.referenceNo}</p>
              </div>
              <button
                onClick={handleModalClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Iframe View */}
            <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-6 flex flex-col md:flex-row gap-6 overflow-y-auto">
              {/* Left Column: Interactive Actions */}
              <div className="w-full md:w-64 space-y-4 shrink-0">
                {/* 2. Choose Print Format */}
                <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                  <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase block tracking-wider">Choose Layout</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPdfUrl(pdfUrlA4);
                        setPreviewMode('invoice');
                      }}
                      className={`py-1.5 rounded-lg text-3xs font-extrabold transition-all border cursor-pointer ${
                        previewMode === 'invoice' 
                          ? 'bg-indigo-600 border-indigo-500 text-white' 
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
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
                      className={`py-1.5 rounded-lg text-3xs font-extrabold transition-all border cursor-pointer ${
                        previewMode === 'bill' 
                          ? 'bg-indigo-600 border-indigo-500 text-white' 
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Thermal POS
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Receipt Controls</span>
                  
                  <Button 
                    onClick={() => {
                      const iframe = document.getElementById('invoice-print-frame');
                      if (iframe) {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();
                      }
                    }} 
                    className="w-full bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer"
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
                    className="w-full border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </Button>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-3xs text-slate-500 dark:text-slate-400">
                  <span className="font-extrabold text-slate-700 dark:text-slate-400 block uppercase">Terms & Instructions:</span>
                  <p>1. Ensure your thermal or laser print spooler is active.</p>
                  <p>2. Select <strong>A4 Invoice</strong> to include full terms and conditions on a dedicated page.</p>
                  <p>3. Select <strong>Thermal POS</strong> for a compact bill receipt excluding terms to conserve paper.</p>
                </div>
              </div>

              {/* Right Column: PDF Viewer */}
              <div className="flex-1 min-h-[500px] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 relative">
                {pdfUrl ? (
                  <iframe
                    id="invoice-print-frame"
                    src={pdfUrl}
                    className="w-full h-full border-none"
                    title="PDF Preview"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <span className="text-xs font-semibold">Compiling jsPDF Vector Elements...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
              <Button onClick={handleModalClose} variant="outline" className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 bg-white dark:bg-slate-900 px-6 py-2 rounded-xl text-xs font-bold cursor-pointer">
                Close & Go to Order Registry
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
