import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  ShoppingCart, PlusCircle, Trash2, Info, Printer, X, Check, 
  AlertTriangle, FileText, Calendar, Compass, ShieldAlert, Sparkles, 
  Layers, Search, Plus, Minus, Tag, RefreshCw, Download, Loader2,
  ArrowRight, ExternalLink, Eye, LayoutDashboard, Package, Truck, Receipt, ArrowLeft, Clock, CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import SearchSelect from '@/components/ui/SearchSelect';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import { Pagination } from '@/components/ui/Pagination';
import useAuthStore from '@/app/store/authStore';
import useCompanyStore from '@/app/store/companyStore';

const DEFAULT_GTC = `1. Acceptance of Order: The vendor must confirm acceptance of the Purchase Order (PO) in writing via email or signed acknowledgment within 03 working days from the date of issue. If no written confirmation is received within this window, the Buyer reserves the right to cancel the order without any financial liability.
2. Price and Taxes: Prices stated in this PO are firm, fixed, and non-escalating. Prices are inclusive of all packing, forwarding, freight, transit insurance, and handling charges up to the delivery site. All taxes, specifically GST, must be clearly itemized on the invoice in strict accordance with CGST, SGST, and IGST rules. Any future tax benefits or Input Tax Credit (ITC) changes must be passed on to the Buyer.
3. Warranty: The Vendor warrants that all supplied goods are brand new, genuine, and free from defects in material and workmanship for 12 months from the date of acceptance. For services, the Vendor guarantees performance by qualified personnel matching industry standards. Any defective goods or substandard services identified within this period must be replaced, repaired, or re-performed by the Vendor within 7 business days at no additional cost to the Buyer.
4. Billing Instructions: Invoices must be raised as statutory Tax Invoices clearly bearing the Vendor’s valid GSTIN, correct HSN/SAC codes, and the exact Buyer PO number. Delayed submission of invoices or failure to upload invoice data to the GST portal (preventing the Buyer from claiming Input Tax Credit) will directly result in a corresponding delay in payment processing.
5. Payment Terms: Payment shall be processed via electronic transfer (NEFT/RTGS) split across two strict milestones: 50% Advance Payment: Processed within 7 working days upon written confirmation and formal acceptance of the Purchase Order (PO) by the Vendor, against the submission of a valid Proforma Invoice. 50% Final Payment: Processed within 45 days from the date of successful physical delivery of all materials at the designated site. This is subject to the submission of complete, error-free documents (Tax Invoice, Delivery Challan, and validated E-way Bill) and physical inspection and acceptance of the defect-free materials by the Buyer's site team.
6. Delivery & Liquidated Damages (LD): The delivery timeline starts immediately upon the Vendor's receipt of the 50% advance payment and must be completed strictly within 25Days. Failure to deliver on time will result in a penalty of 0.5% of the total PO value per week of delay, capped at 10%. Exceeding this 10% limit gives the Buyer the right to terminate the contract immediately and source elsewhere at the Vendor's expense.
7. Quality & Inspection: All deliverables must strictly match the technical specifications mentioned in the PO. The Buyer reserves the right to inspect materials upon arrival at the site. The Buyer can reject any defective, damaged, or substandard items. Rejected goods must be collected and removed by the Vendor from the Buyer's premises within 7 days of rejection notification at the Vendor's sole risk and expense.
8. Statutory Compliance: The Vendor shall strictly comply with all applicable Central, State, and local government laws, labor regulations (including Provident Fund, ESIC, and Minimum Wages acts), and anti-bribery policies. The use of child labor is strictly prohibited. The Vendor is solely responsible for generating accurate E-way bills for all transit movements.
9. Dispute Resolution: Any dispute arising out of this PO shall first be resolved through amicable mutual discussions. Unresolved disputes shall be referred to a sole arbitrator appointed mutually by both parties, governed by the Indian Arbitration and Conciliation Act, 1996. The venue and seat of arbitration shall be Tamil Nadu, and proceedings will be conducted in English. The courts in Salem shall have exclusive jurisdiction over this contract.`;

// Theme-adaptive Quantity Selector component
const QuantitySelector = ({ value, onChange }) => {
  return (
    <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden w-full max-w-[120px] h-8.5 transition-colors">
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
          onChange(Math.max(1, parseInt(cleanVal) || 1));
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
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl mt-8">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto animate-bounce" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">View-Only Access</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">As a Supervisor, you have read-only access and cannot place or modify sales orders.</p>
        <Button onClick={() => navigate('/orders/list')} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer font-bold text-xs">
          Back to Order List
        </Button>
      </div>
    );
  }

  // Search & Catalog Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [catalogPage, setCatalogPage] = useState(1);

  useEffect(() => {
    setCatalogPage(1);
  }, [searchQuery, selectedCategory]);

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
  const [showGtcAccordion, setShowGtcAccordion] = useState(false);
  
  const storeCompany = useCompanyStore((s) => s.company);

  // Tax Configuration & Predictions
  const [collectTax, setCollectTax] = useState(true);
  const [taxRegNo, setTaxRegNo] = useState('');
  const [taxType, setTaxType] = useState('Exclusive');
  const [ourGstin, setOurGstin] = useState(storeCompany?.companyGstin || '');
  const [interstateGstRate, setInterstateGstRate] = useState(18);

  // Short Details Executive Summary Modal
  const [showShortSummaryModal, setShowShortSummaryModal] = useState(false);

  // Loaded company details
  const [companyInfo, setCompanyInfo] = useState({
    companyName: storeCompany?.companyName || 'Company',
    companyAddress: storeCompany?.companyAddress || 'Factory / Registered Office Address',
    companyGstin: storeCompany?.companyGstin || '',
    companyMobile: storeCompany?.companyMobile || '',
    collectTax: storeCompany?.collectTax || 'Yes',
    taxRegNo: storeCompany?.taxRegNo || storeCompany?.companyGstin || '',
    taxType: storeCompany?.taxType || 'Exclusive Tax'
  });

  // Checkout Calculations Inputs
  const [discountType, setDiscountType] = useState('Flat');
  const [discountValue, setDiscountValue] = useState('0');
  const [tdsDeduction, setTdsDeduction] = useState('0');

  const [freight, setFreight] = useState('0');
  const [freightGst, setFreightGst] = useState(true);

  const [loadingCharges, setLoadingCharges] = useState('0');
  const [loadingGst, setLoadingGst] = useState(true);

  const [packingCharges, setPackingCharges] = useState('0');
  const [packingGst, setPackingGst] = useState(true);

  const [insurance, setInsurance] = useState('0');
  const [insuranceGst, setInsuranceGst] = useState(true);

  const [otherCharges, setOtherCharges] = useState('0');
  const [otherGst, setOtherGst] = useState(true);

  const [items, setItems] = useState([]);
  const [stockSufficiency, setStockSufficiency] = useState({});
  const [estimates, setEstimates] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // New Customer Modal
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
  const [previewMode, setPreviewMode] = useState('invoice');

  const categories = ['All', ...new Set(products.map(p => p.category?.name).filter(Boolean))];

  const handleNumericInputChange = (val, setter) => {
    let cleaned = val.replace(/[^0-9]/g, '');
    cleaned = cleaned.replace(/^0+(?=\d)/, '');
    setter(cleaned === '' ? '0' : cleaned);
  };

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
        const [custRes, prodRes, taxSettingsRes] = await Promise.all([
          api.get('/parties/customers'),
          api.get('/products'),
          api.get('/setup/tax').catch(err => {
            console.warn('Unable to load tax settings endpoints', err);
            return { data: null };
          })
        ]);

        setCustomers(custRes.data || []);
        setProducts(prodRes.data || []);

        if (taxSettingsRes.data) {
          setCompanyInfo({
            companyName: taxSettingsRes.data.companyName || storeCompany?.companyName || 'Company',
            companyAddress: taxSettingsRes.data.companyAddress || storeCompany?.companyAddress || 'Factory / Registered Office Address',
            companyGstin: taxSettingsRes.data.companyGstin || storeCompany?.companyGstin || '',
            companyMobile: taxSettingsRes.data.companyMobile || storeCompany?.companyMobile || '',
            collectTax: taxSettingsRes.data.collectTax || 'Yes',
            taxRegNo: taxSettingsRes.data.taxRegNo || taxSettingsRes.data.companyGstin || '',
            taxType: taxSettingsRes.data.taxType || 'Exclusive Tax'
          });
          setOurGstin(taxSettingsRes.data.companyGstin || storeCompany?.companyGstin || '');
        }

        if (isEditMode) {
          setIsClockRunning(false);
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
          setDiscountValue(String(order.discountValue || 0));
          setTdsDeduction(String(order.tdsDeduction || 0));
          setFreight(String(order.freight || 0));
          setFreightGst(!!order.freightGst);
          setLoadingCharges(String(order.loadingCharges || 0));
          setLoadingGst(!!order.loadingGst);
          setPackingCharges(String(order.packingCharges || 0));
          setPackingGst(!!order.packingGst);
          setInsurance(String(order.insurance || 0));
          setInsuranceGst(!!order.insuranceGst);
          setOtherCharges(String(order.otherCharges || 0));
          setOtherGst(!!order.otherGst);
          setItems(order.items.map(it => ({
            productId: it.productId,
            quantity: Number(it.quantity),
            unitPrice: Math.round(Number(it.unitPrice)),
            discount: Math.round(Number(it.discount)),
            deliveryDate: new Date(it.deliveryDate).toISOString().split('T')[0]
          })));
        } else {
          const retail = (custRes.data || []).find(c => c.name.toUpperCase().includes('RETAIL')) || (custRes.data || [])[0];
          if (retail) {
            setCustomerId(retail.id);
            setTaxRegNo(retail.gstin || '');
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

  useEffect(() => {
    if (customerId && customers.length > 0) {
      const cust = customers.find(c => c.id === customerId);
      if (cust) {
        setTaxRegNo(cust.gstin || '');
        if (cust.address) setDeliveryAddress(cust.address);
      }
    }
  }, [customerId, customers]);

  const handleAddProductClick = (product) => {
    const avail = Number(product.currentStock || 0);
    const existingIndex = items.findIndex(it => it.productId === product.id);
    
    if (existingIndex > -1) {
      const currentQty = items[existingIndex].quantity;
      if (currentQty + 1 > avail) {
        Swal.fire({
          title: 'Stock Limit Exceeded',
          html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Cannot add more units. Only <strong>${avail}</strong> units of "${product.name}" are available in stock.</p>`,
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
          html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">"${product.name}" is currently out of stock.</p>`,
          icon: 'warning',
          confirmButtonColor: '#6366f1'
        });
        return;
      }
      setItems([...items, {
        productId: product.id,
        quantity: 1,
        unitPrice: Math.round(Number(product.salePrice || 0)),
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
          html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Cannot set quantity to ${newQty}. Only <strong>${avail}</strong> units of "${prod?.name || 'this product'}" are available in stock.</p>`,
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

  const getTaxRates = () => {
    if (!collectTax) return { isInterState: false, cgst: 0, sgst: 0, igst: 0 };
    
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

  const itemsCgstVal = rates.isInterState ? 0 : taxableBase * (rates.cgst / 100);
  const itemsSgstVal = rates.isInterState ? 0 : taxableBase * (rates.sgst / 100);
  const itemsIgstVal = rates.isInterState ? taxableBase * (rates.igst / 100) : 0;

  const cgstVal = itemsCgstVal + (rates.isInterState ? 0 : (freightGstVal + loadingGstVal + packingGstVal + insuranceGstVal + otherGstVal) / 2);
  const sgstVal = itemsSgstVal + (rates.isInterState ? 0 : (freightGstVal + loadingGstVal + packingGstVal + insuranceGstVal + otherGstVal) / 2);
  const igstVal = itemsIgstVal + (rates.isInterState ? (freightGstVal + loadingGstVal + packingGstVal + insuranceGstVal + otherGstVal) : 0);

  const subtotalBeforeTax = taxableBase + freightVal + loadingVal + packingVal + insuranceVal + otherVal;
  const totalTax = cgstVal + sgstVal + igstVal;
  const grandTotalBeforeTds = subtotalBeforeTax + totalTax;
  const grandTotalFinal = Math.max(0, grandTotalBeforeTds - Math.round(Number(tdsDeduction)));
  const roundedGrandTotal = Math.round(grandTotalFinal);
  const roundOff = roundedGrandTotal - grandTotalFinal;

  const totalItemQtyCount = items.reduce((acc, it) => acc + Number(it.quantity || 0), 0);

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

    const companyName = companyInfo?.companyName || storeCompany?.companyName || 'Company';
    const companyAddress = companyInfo?.companyAddress || storeCompany?.companyAddress || 'Factory / Registered Office Address';
    const companyGstin = companyInfo?.companyGstin || storeCompany?.companyGstin || '';
    const companyMobile = companyInfo?.companyMobile || storeCompany?.companyMobile || '';

    const customerGstin = taxRegNo || '';
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
      doc.text(prod?.name || 'Product', 24, tY + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.text(prod?.hsnCode || '21050000', 95, tY + 4.5);
      doc.text(String(qty), 120, tY + 4.5, { align: 'right' });
      doc.text(`Rs.${rate}`, 140, tY + 4.5, { align: 'right' });
      doc.text(`Rs.${disc}`, 160, tY + 4.5, { align: 'right' });
      doc.text(`Rs.${lineTotalVal}`, 192, tY + 4.5, { align: 'right' });

      tY += 7.5;
    });

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
    doc.text('DIGITALLY VERIFIED', 165, sigY + 8.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.text('AUTHORISED SIGNATORY', 165, sigY + 13, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Page 2 of 2 - Generated via ERP System.', 105, 286, { align: 'center' });

    return doc.output('blob');
  };

  const compileThermalBillPDF = (order) => {
    const companyName = companyInfo?.companyName || storeCompany?.companyName || 'Company';
    const companyAddress = companyInfo?.companyAddress || storeCompany?.companyAddress || 'Factory / Registered Office Address';
    const companyGstin = companyInfo?.companyGstin || storeCompany?.companyGstin || '';
    
    const itemsCount = items.length;
    
    const freightVal = Math.round(Number(freight) || 0);
    const loadingVal = Math.round(Number(loadingCharges) || 0);
    const packingVal = Math.round(Number(packingCharges) || 0);
    const insuranceVal = Math.round(Number(insurance) || 0);
    const otherVal = Math.round(Number(otherCharges) || 0);
    const discountVal = Math.round(Number(discountValue) || 0);
    
    let activeChargesCount = 0;
    if (freightVal > 0) activeChargesCount++;
    if (loadingVal > 0) activeChargesCount++;
    if (packingVal > 0) activeChargesCount++;
    if (insuranceVal > 0) activeChargesCount++;
    if (otherVal > 0) activeChargesCount++;
    
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
    
    let dynamicHeight = 115 + (itemsCount * 9) + (activeChargesCount * 3.5);
    if (collectTax) dynamicHeight += 8;
    if (discountVal > 0) dynamicHeight += 3.5;
    
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, dynamicHeight]
    });
    
    doc.setDrawColor(180, 180, 180);
    doc.line(3, 3, 77, 3);
    doc.line(3, dynamicHeight - 3, 77, dynamicHeight - 3);
    doc.line(3, 3, 3, dynamicHeight - 3);
    doc.line(77, 3, 77, dynamicHeight - 3);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 27, 75);
    doc.text('RETAIL BILL', 40, 9, { align: 'center' });
    
    doc.setFontSize(7.5);
    doc.text(companyName.toUpperCase(), 40, 13, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(71, 85, 105);
    const addressLines = doc.splitTextToSize(companyAddress, 70);
    doc.text(addressLines, 40, 16, { align: 'center' });
    
    let curY = 16 + (addressLines.length * 3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 27, 75);
    doc.text(`GSTIN: ${companyGstin}`, 40, curY, { align: 'center' });
    
    curY += 3;
    doc.setDrawColor(220, 220, 220);
    doc.line(5, curY, 75, curY);
    
    curY += 4;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    
    const createdDate = new Date(order.createdAt || orderDate);
    const formattedDate = createdDate.toLocaleDateString('en-GB');
    const formattedTime = createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    
    doc.text(`Bill No: ${order.referenceNo || 'N/A'}`, 5, curY);
    doc.text(`Date: ${formattedDate}`, 45, curY);
    
    curY += 3.5;
    doc.text(`Time: ${formattedTime}`, 45, curY);
    
    const selectedCust = customers.find(c => c.id === customerId);
    doc.text(`Customer: ${(selectedCust?.name || 'Walk-in Customer').substring(0, 22)}`, 5, curY);
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
    items.forEach((item) => {
      const prod = products.find(p => p.id === item.productId);
      const qty = Number(item.quantity) || 0;
      const rate = Math.round(Number(item.unitPrice) || 0);
      const disc = Math.round(Number(item.discount) || 0);
      const lineTotal = (rate - disc) * qty;
      
      const nameTrunc = (prod?.name || 'Product').substring(0, 18);
      doc.setFont('helvetica', 'bold');
      doc.text(nameTrunc, 5, curY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(qty), 38, curY, { align: 'right' });
      doc.text(`Rs.${rate - disc}`, 53, curY, { align: 'right' });
      doc.text(`Rs.${lineTotal}`, 75, curY, { align: 'right' });
      curY += 4.5;
    });
    
    doc.line(5, curY - 1.5, 75, curY - 1.5);
    
    curY += 3.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(30, 27, 75);
    doc.text('Invoice Charges Summary', 40, curY, { align: 'center' });

    curY += 2.5;
    doc.line(20, curY, 60, curY);

    curY += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(50, 50, 50);

    doc.text('Taxable Subtotal:', 48, curY, { align: 'right' });
    doc.text(`Rs.${taxableValue.toFixed(2)}`, 75, curY, { align: 'right' });

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
      const isTamilNadu = taxRegNo.trim().replace(/^GSTIN-/, '').substring(0, 2) === '33' || !taxRegNo;
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

    const tdsVal = Number(order?.tdsDeduction || order?.tds || 0);
    if (tdsVal > 0) {
      curY += 3.2;
      doc.text('TDS Deduction (Rs.):', 48, curY, { align: 'right' });
      doc.text(`-Rs.${tdsVal.toFixed(2)}`, 75, curY, { align: 'right' });
    }

    const roundOffVal = Number(order?.roundOff || 0);
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
      setPdfUrl(a4Url);
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

  const CATALOG_PAGE_SIZE = 20;
  const totalCatalogPages = Math.ceil(filteredProducts.length / CATALOG_PAGE_SIZE);
  const paginatedProducts = filteredProducts.slice(
    (catalogPage - 1) * CATALOG_PAGE_SIZE,
    catalogPage * CATALOG_PAGE_SIZE
  );

  const handleModalClose = () => {
    setShowInvoiceModal(false);
    navigate('/orders/list');
  };

  const selectedCustomerObj = customers.find(c => c.id === customerId);

  return (
    <div className="w-full max-w-full px-3 sm:px-5 py-3 space-y-3.5 mx-auto transition-all duration-300 text-slate-900 dark:text-slate-100">
      
      {/* Sleek, Space-Efficient Single Top Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-3 sm:p-4 rounded-2xl flex flex-wrap justify-between items-center gap-3 shadow-xs dark:shadow-xl transition-all">
        <div className="flex items-center space-x-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/orders/list')}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer h-9 w-9 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                {isEditMode ? `Edit Order #${createdOrderRef || id}` : 'Sales Order POS'}
              </h1>
              <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-black border border-indigo-200 dark:border-indigo-800 uppercase tracking-wide">
                Billing Workspace
              </span>
            </div>
          </div>
        </div>

        {/* Live Order Metric Summary Pill Bar */}
        <div className="hidden lg:flex items-center gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 rounded-xl text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Client:</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200 line-clamp-1 max-w-[120px]">
              {selectedCustomerObj?.name || 'Walk-in'}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Cart:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{items.length} lines ({totalItemQtyCount} units)</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Total:</span>
            <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">₹{roundedGrandTotal}</span>
          </div>
        </div>

        {/* Quick ERP Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowShortSummaryModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer shadow-xs"
            title="View Executive Summary Sheet"
          >
            <Eye className="w-3.5 h-3.5" /> Summary Sheet
          </button>

          <button
            type="button"
            onClick={() => navigate('/orders/list')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 transition-all cursor-pointer shadow-2xs"
          >
            <Receipt className="w-3.5 h-3.5 text-indigo-500" /> Orders
          </button>

          <button
            type="button"
            onClick={() => navigate('/dashboard/sales')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 transition-all cursor-pointer shadow-2xs"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-violet-500" /> Dashboard
          </button>

          <button
            type="button"
            onClick={() => navigate('/products/stock')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 transition-all cursor-pointer shadow-2xs"
          >
            <Package className="w-3.5 h-3.5 text-emerald-500" /> Products
          </button>
        </div>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* LEFT 7 COLUMNS: Product Catalog Selection & Search */}
          <div className="lg:col-span-7 space-y-4">
            
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs dark:shadow-xl">
              <CardHeader className="py-3 px-4 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-500" /> POS Product Catalog
                </h3>
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-2.5 py-0.5 rounded-full font-black border border-indigo-100 dark:border-indigo-900">
                  {filteredProducts.length} Products Available
                </span>
              </CardHeader>
              <CardContent className="p-3.5 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <Input
                    placeholder="Search product by name or code (e.g. FP-000006)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-9.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 text-3xs font-extrabold rounded-xl transition-all cursor-pointer border ${
                        selectedCategory === cat
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Grid cards displaying product visual details */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {paginatedProducts.map((p) => {
                    const avail = Number(p.currentStock || 0);
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleAddProductClick(p)}
                        className="bg-slate-50 dark:bg-slate-950 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer overflow-hidden transition-all hover:scale-[1.02] hover:border-indigo-500/50 dark:hover:border-indigo-500/70 shadow-2xs flex flex-col justify-between"
                      >
                        <div className="h-20 bg-gradient-to-br from-indigo-50 to-slate-100 dark:from-indigo-950 dark:to-slate-900 flex items-center justify-center text-3xl rounded-t-xl relative overflow-hidden border-b border-slate-200/80 dark:border-slate-900">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <span>{getProductEmoji(p.name)}</span>
                              <span className="text-[7px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black">Item</span>
                            </div>
                          )}
                        </div>

                        <div className="p-2.5 flex flex-col justify-between flex-1 space-y-2">
                          <div>
                            <span className="text-[8px] font-mono font-bold text-slate-400 dark:text-slate-500 block">{p.code}</span>
                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 line-clamp-1">{p.name}</h4>
                          </div>
                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 dark:border-slate-900">
                            <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400">₹{Math.round(Number(p.salePrice || 0))}</span>
                            <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${
                              avail > 0 
                                ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50' 
                                : 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
                            }`}>
                              Qty: {avail}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {totalCatalogPages > 1 && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-2">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
                      Showing {(catalogPage - 1) * CATALOG_PAGE_SIZE + 1} to {Math.min(catalogPage * CATALOG_PAGE_SIZE, filteredProducts.length)} of {filteredProducts.length} entries
                    </div>
                    <div className="order-1 sm:order-2">
                      <Pagination
                        currentPage={catalogPage}
                        totalPages={totalCatalogPages}
                        onPageChange={setCatalogPage}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Collapsible GTC Accordion to save vertical space */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div 
                onClick={() => setShowGtcAccordion(!showGtcAccordion)} 
                className="py-2.5 px-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors"
              >
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" /> Quotation Terms & Conditions (GTC)
                </h3>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                  {showGtcAccordion ? 'Collapse Terms' : 'Expand Terms'}
                  {showGtcAccordion ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
              {showGtcAccordion && (
                <CardContent className="p-3 border-t border-slate-100 dark:border-slate-800">
                  <textarea
                    value={gtcText}
                    onChange={(e) => setGtcText(e.target.value)}
                    className="w-full h-36 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl p-2.5 text-xs leading-normal font-mono focus:outline-none focus:border-indigo-500"
                    placeholder="Provide quotation terms & conditions here..."
                  />
                </CardContent>
              )}
            </Card>

          </div>

          {/* RIGHT 5 COLUMNS: High-Density Billing Desk (Customer, Cart, & Charges) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Card 1: Customer & Order Parameters */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-xl rounded-2xl overflow-visible">
              <CardHeader className="py-2.5 px-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-indigo-500" /> Customer & Order Setup
                </h3>
              </CardHeader>
              <CardContent className="p-3.5 space-y-3 text-xs">
                
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Customer Name *</label>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomer(true)}
                      className="text-3xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Quick Add
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
                    triggerClassName="h-9 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Order Mode</label>
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
                      triggerClassName="h-9 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Payment Terms</label>
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
                      triggerClassName={`h-9 text-xs font-bold border rounded-xl transition-all ${
                        paymentTerms === 'Paid'
                          ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
                          : paymentTerms === 'Advance Payment'
                          ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
                          : 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
                      }`}
                    />
                  </div>
                </div>

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
                    <DatePicker
                      required
                      showTime
                      value={orderDate}
                      onChange={(date) => {
                        setIsClockRunning(false);
                        setOrderDate(date || new Date());
                      }}
                      modalTitle="Select Order Timestamp"
                      placeholder="Select date"
                      className="space-y-0"
                      triggerClassName="h-9 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white w-full"
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Customer GSTIN</label>
                    <Input
                      placeholder="GSTIN No"
                      value={taxRegNo}
                      onChange={(e) => setTaxRegNo(e.target.value.toUpperCase())}
                      className="h-9 text-xs font-mono font-bold uppercase tracking-wider bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Shipping Address</label>
                    <Input
                      placeholder="Destination address..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="h-9 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Selected Order Items Cart */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-visible shadow-xs dark:shadow-xl">
              <CardHeader className="py-2.5 px-4 border-b border-slate-100 dark:border-slate-800 flex flex-row justify-between items-center">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-indigo-500" /> Selected Item Lines
                </h3>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded-full font-black text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                  {items.length} Lines
                </span>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                {items.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 dark:text-slate-500 italic text-xs border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/40">
                    Click products from the catalog to add items here.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {items.map((item, idx) => {
                      const prod = products.find(p => p.id === item.productId);
                      const qty = Number(item.quantity) || 0;
                      const rate = Math.round(Number(item.unitPrice) || 0);
                      const disc = Math.round(Number(item.discount) || 0);

                      const lineSubtotal = (rate - disc) * qty;
                      const lineCost = prod ? Number(prod.totalCost || 0) * qty : 0;
                      const lineProfit = lineSubtotal - lineCost;
                      const sufficiency = stockSufficiency[item.productId];

                      return (
                        <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-black text-[10px]">
                                {idx + 1}
                              </span>
                              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 line-clamp-1">
                                {prod?.name || 'Loading...'} <span className="text-[9px] text-slate-400 font-mono">({prod?.code})</span>
                              </h4>
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
                                step="1"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                                className="font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-8.5 rounded-xl text-slate-900 dark:text-white"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[8px] font-bold text-slate-400 uppercase block">Disc (₹)</label>
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                value={item.discount}
                                onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                                className="font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-8.5 rounded-xl text-slate-900 dark:text-white"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-900 text-[10px] font-mono">
                            <div>
                              {sufficiency && (
                                <span className={`px-1.5 py-0.5 text-[8px] font-black rounded uppercase ${
                                  sufficiency.status === 'Sufficient'
                                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                                }`}>
                                  {sufficiency.status === 'Sufficient' ? 'In Stock' : `Short: ${sufficiency.shortage}`}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-3">
                              <span className="text-slate-500">Subtotal: <strong className="text-slate-800 dark:text-white">₹{lineSubtotal}</strong></span>
                              <span className={`font-bold ${lineProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                Profit: ₹{lineProfit.toFixed(0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card 3: Tax & Charges Ledger + Prominent Submit Checkout Button */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="py-2.5 px-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
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
              </CardHeader>
              <CardContent className="p-3.5 space-y-3 text-xs">
                
                {/* Discount input row */}
                <div className="flex gap-2 items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Discount:</span>
                  <div className="flex bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDiscountType('Flat')}
                      className={`px-2 py-0.5 text-3xs font-extrabold rounded ${discountType === 'Flat' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
                    >
                      ₹
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('Percent')}
                      className={`px-2 py-0.5 text-3xs font-extrabold rounded ${discountType === 'Percent' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
                    >
                      %
                    </button>
                  </div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={discountValue}
                    onChange={(e) => handleNumericInputChange(e.target.value, setDiscountValue)}
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white h-8 text-xs font-mono font-bold"
                  />
                </div>

                {/* Additional charges grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                      <span>Freight (₹)</span>
                      <label className="cursor-pointer flex items-center gap-0.5"><input type="checkbox" checked={freightGst} onChange={() => setFreightGst(!freightGst)} className="w-2.5 h-2.5 accent-indigo-600" /> GST</label>
                    </div>
                    <Input type="text" inputMode="numeric" value={freight} onChange={(e) => handleNumericInputChange(e.target.value, setFreight)} className="h-7.5 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                      <span>Loading (₹)</span>
                      <label className="cursor-pointer flex items-center gap-0.5"><input type="checkbox" checked={loadingGst} onChange={() => setLoadingGst(!loadingGst)} className="w-2.5 h-2.5 accent-indigo-600" /> GST</label>
                    </div>
                    <Input type="text" inputMode="numeric" value={loadingCharges} onChange={(e) => handleNumericInputChange(e.target.value, setLoadingCharges)} className="h-7.5 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                      <span>Packing (₹)</span>
                      <label className="cursor-pointer flex items-center gap-0.5"><input type="checkbox" checked={packingGst} onChange={() => setPackingGst(!packingGst)} className="w-2.5 h-2.5 accent-indigo-600" /> GST</label>
                    </div>
                    <Input type="text" inputMode="numeric" value={packingCharges} onChange={(e) => handleNumericInputChange(e.target.value, setPackingCharges)} className="h-7.5 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                      <span>Other (₹)</span>
                      <label className="cursor-pointer flex items-center gap-0.5"><input type="checkbox" checked={otherGst} onChange={() => setOtherGst(!otherGst)} className="w-2.5 h-2.5 accent-indigo-600" /> GST</label>
                    </div>
                    <Input type="text" inputMode="numeric" value={otherCharges} onChange={(e) => handleNumericInputChange(e.target.value, setOtherCharges)} className="h-7.5 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono" />
                  </div>
                </div>

                {/* Calculation Ledger Lines */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs font-semibold">
                  <div className="flex justify-between text-slate-500">
                    <span>Taxable Subtotal:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">₹{taxableValue}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-rose-500">
                      <span>Discount Amount:</span>
                      <span className="font-mono">-₹{discountAmount}</span>
                    </div>
                  )}
                  {collectTax && (
                    <div className="flex justify-between text-indigo-600 dark:text-indigo-400">
                      <span>GST Tax ({rates.isInterState ? `IGST ${interstateGstRate}%` : 'CGST+SGST 18%'}):</span>
                      <span className="font-mono">₹{Math.round(totalTax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-indigo-600 dark:text-indigo-400 border-t border-slate-200 dark:border-slate-800 pt-1.5">
                    <span>Grand Total:</span>
                    <span className="font-mono text-base text-indigo-600 dark:text-indigo-400">₹{roundedGrandTotal}</span>
                  </div>
                </div>

                {/* Prominent Submit Order Action Button */}
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || items.length === 0 || !customerId}
                  className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black py-3 h-12 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center text-xs gap-2 border border-indigo-500/50"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {submitting ? 'Submitting Order Specs...' : isEditMode ? 'Save Order Modifications' : 'Create Order & Print Receipt'}
                </Button>

              </CardContent>
            </Card>

          </div>
        </div>
      </form>

      {/* Inline Customer Registration Modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 w-full max-w-md rounded-3xl shadow-2xl p-5 relative border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setShowAddCustomer(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider mb-4">Quick Add Customer</h3>
            <form onSubmit={handleAddCustomerSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Customer Name *</label>
                <Input
                  required
                  placeholder="Enter customer name"
                  value={newCustForm.name}
                  onChange={(e) => setNewCustForm({...newCustForm, name: e.target.value})}
                  className="h-9 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Phone *</label>
                  <Input
                    required
                    placeholder="Enter phone"
                    value={newCustForm.phone}
                    onChange={(e) => setNewCustForm({...newCustForm, phone: e.target.value})}
                    className="h-9 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Customer GSTIN</label>
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
                  <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Email Address</label>
                  <Input
                    placeholder="Enter email"
                    type="email"
                    value={newCustForm.email}
                    onChange={(e) => setNewCustForm({...newCustForm, email: e.target.value})}
                    className="h-9 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Customer Type</label>
                  <select
                    value={newCustForm.customerType}
                    onChange={(e) => setNewCustForm({...newCustForm, customerType: e.target.value})}
                    className="w-full h-9 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 text-xs focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="RETAIL">Retail</option>
                    <option value="DISTRIBUTOR">Distributor</option>
                    <option value="WHOLESALER">Wholesaler</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Billing / Delivery Address</label>
                <Input
                  placeholder="Billing address"
                  value={newCustForm.address}
                  onChange={(e) => setNewCustForm({...newCustForm, address: e.target.value})}
                  className="h-9 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold h-10 rounded-xl cursor-pointer">
                Save & Select Customer
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Short Details Executive Summary Modal (Single Compact Page View) */}
      {showShortSummaryModal && (
        <div className="fixed inset-0 bg-slate-950/70 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Executive Order Summary Sheet
                </h3>
              </div>
              <button
                onClick={() => setShowShortSummaryModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Client</span>
                  <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {selectedCustomerObj?.name || 'Walk-in Customer'}
                  </p>
                  <p className="font-mono text-slate-500 dark:text-slate-400 text-[10px]">
                    GSTIN: {taxRegNo || 'Unregistered'}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">{deliveryAddress || 'No address specified'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Parameters</span>
                  <p className="font-extrabold text-slate-900 dark:text-white text-xs">{orderType}</p>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">{paymentTerms}</p>
                  <p className="font-mono text-slate-500 dark:text-slate-400 text-[10px]">
                    Delivery: {new Date(deliveryDate).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-[10px] uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-2">Item Name</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Disc</th>
                      <th className="px-3 py-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((it, idx) => {
                      const prod = products.find(p => p.id === it.productId);
                      const q = Number(it.quantity);
                      const r = Math.round(Number(it.unitPrice));
                      const d = Math.round(Number(it.discount));
                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-950/50">
                          <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">{prod?.name || 'Product'}</td>
                          <td className="px-3 py-2 text-right font-mono">{q}</td>
                          <td className="px-3 py-2 text-right font-mono">₹{r}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-400">₹{d}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-white">₹{(r - d) * q}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal Value:</span>
                  <span>₹{taxableValue}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <span>Discount:</span>
                    <span>-₹{discountAmount}</span>
                  </div>
                )}
                {collectTax && (
                  <div className="flex justify-between text-indigo-600 dark:text-indigo-400">
                    <span>GST Taxes:</span>
                    <span>₹{Math.round(totalTax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 pt-2 font-sans">
                  <span>Grand Total:</span>
                  <span className="font-mono text-base text-indigo-600 dark:text-indigo-400">₹{roundedGrandTotal}</span>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
              <Button onClick={() => setShowShortSummaryModal(false)} variant="outline" className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl">
                Close Sheet
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Receipt Modal Overlay */}
      {showInvoiceModal && invoiceData && (
        <div className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
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

            <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-5 flex flex-col md:flex-row gap-5 overflow-y-auto">
              <div className="w-full md:w-64 space-y-4 shrink-0">
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

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Receipt Controls</span>
                  
                  <Button 
                    onClick={() => {
                      const iframe = document.getElementById('invoice-print-frame');
                      if (iframe) {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();
                      }
                    }} 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer text-xs"
                  >
                    <Printer className="w-4 h-4" /> Spool Print
                  </Button>

                  <Button 
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = pdfUrl;
                      const now = new Date();
                      const datePart = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
                      const timePart = String(now.getHours()).padStart(2, '0') + '-' + String(now.getMinutes()).padStart(2, '0') + '-' + String(now.getSeconds()).padStart(2, '0');
                      const customerNamePart = (invoiceData.customerName || 'Walk-in_Customer').trim().replace(/[^a-zA-Z0-9-]/g, '_');
                      a.download = `${customerNamePart}_${datePart}_${timePart}.pdf`;
                      a.click();
                    }} 
                    variant="outline" 
                    className="w-full border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold py-2 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </Button>
                </div>
              </div>

              <div className="flex-1 min-h-[480px] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 relative">
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

            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
              <Button onClick={handleModalClose} variant="outline" className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 px-6 py-1.5 rounded-xl text-xs font-bold cursor-pointer">
                Close & Go to Order Registry
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
