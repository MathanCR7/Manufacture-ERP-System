import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { ShoppingCart, PlusCircle, Trash2, Info, Printer, X, Check, AlertTriangle, FileText, Calendar, Compass, ShieldAlert, Sparkles, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import SearchSelect from '@/components/ui/SearchSelect';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import Swal from 'sweetalert2';

export default function AddOrderPage() {
  const { id } = useParams();
  const isEditMode = !!id;
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const navigate = useNavigate();

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [orderType, setOrderType] = useState('Sales Order');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderDate, setOrderDate] = useState(new Date());
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [quotationNote, setQuotationNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Not Paid');
  
  // Tax Configuration
  const [collectTax, setCollectTax] = useState(true);
  const [taxRegNo, setTaxRegNo] = useState('GSTIN-27AABC1234F1Z5');
  const [taxType, setTaxType] = useState('Exclusive'); // Exclusive or Inclusive
  const [ourGstin, setOurGstin] = useState('33AABCL0702C1ZG'); // Default company GSTIN fallback
  const [interstateGstRate, setInterstateGstRate] = useState(18); // Default selectable IGST rate
  const [globalTaxRates, setGlobalTaxRates] = useState({ cgst: 9, sgst: 9, igst: 9 });

  const [items, setItems] = useState([]);
  const [stockSufficiency, setStockSufficiency] = useState({});
  const [estimates, setEstimates] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Invoice Receipt Modal Overlay
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [createdOrderRef, setCreatedOrderRef] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);

  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const custRes = await api.get('/parties/customers');
        setCustomers(custRes.data || []);

        const prodRes = await api.get('/products');
        setProducts(prodRes.data || []);

        // Fetch our company GSTIN from Tax settings
        try {
          const taxSettingsRes = await api.get('/setup/tax');
          if (taxSettingsRes.data && taxSettingsRes.data.companyGstin) {
            setOurGstin(taxSettingsRes.data.companyGstin);
          }
        } catch (taxErr) {
          console.warn('Unable to load company GSTIN from company settings, using default', taxErr);
        }

        if (isEditMode) {
          const orderRes = await api.get(`/orders/${id}`);
          const order = orderRes.data;
          setCustomerId(order.customerId);
          setOrderType(order.type);
          setDeliveryDate(new Date(order.deliveryDate).toISOString().split('T')[0]);
          setOrderDate(new Date(order.createdAt));
          setDeliveryAddress(order.deliveryAddress || '');
          setQuotationNote(order.quotationNote || '');
          setInternalNote(order.internalNote || '');
          setPaymentTerms(order.paymentTerms || 'Not Paid');
          setItems(order.items.map(it => ({
            productId: it.productId,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            discount: Number(it.discount),
            deliveryDate: new Date(it.deliveryDate).toISOString().split('T')[0]
          })));
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchMasters();

    // Load tax configurations from localStorage helper
    const saved = localStorage.getItem('kulfi_erp_tax_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCollectTax(parsed.collectTax === 'Yes');
        if (parsed.taxRegNo) setTaxRegNo(parsed.taxRegNo);
        if (parsed.taxType) setTaxType(parsed.taxType.replace(' Tax', ''));
        if (parsed.companyGstin) setOurGstin(parsed.companyGstin);
        
        if (parsed.taxes && Array.isArray(parsed.taxes)) {
          const cgstTax = parsed.taxes.find(t => t.name.toUpperCase() === 'CGST');
          const sgstTax = parsed.taxes.find(t => t.name.toUpperCase() === 'SGST');
          const igstTax = parsed.taxes.find(t => t.name.toUpperCase() === 'IGST');
          
          setGlobalTaxRates({
            cgst: cgstTax ? Number(cgstTax.rate) : 9,
            sgst: sgstTax ? Number(sgstTax.rate) : 9,
            igst: igstTax ? Number(igstTax.rate) : 9
          });
        }
      } catch (e) {
        console.error('Error loading tax settings in order', e);
      }
    }
  }, [id, isEditMode]);

  const handleAddItem = () => {
    setItems([...items, {
      productId: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      deliveryDate: new Date().toISOString().split('T')[0]
    }]);
  };

  const handleRemoveItem = (index) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const handleItemChange = (index, field, val) => {
    const updated = [...items];
    updated[index][field] = val;

    // Auto populate unit price if product changes
    if (field === 'productId') {
      const prod = products.find(p => p.id === val);
      if (prod) {
        updated[index].unitPrice = Number(prod.salePrice || 0);
      }
    }

    setItems(updated);
  };

  // Run stock sufficiency & cost/date estimates when items change
  useEffect(() => {
    const validItems = items.filter(it => it.productId && it.quantity > 0);
    if (validItems.length === 0) {
      setStockSufficiency({});
      setEstimates(null);
      return;
    }

    const verifyStockAndEstimates = async () => {
      try {
        // 1. Verify stock sufficiency
        const stockRes = await api.post('/orders/check-stock', {
          items: validItems.map(it => ({ productId: it.productId, quantity: Number(it.quantity) }))
        });
        const sufficiencyMap = {};
        stockRes.data.forEach(res => {
          sufficiencyMap[res.productId] = res;
        });
        setStockSufficiency(sufficiencyMap);

        // 2. Cost and delivery date estimations
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

  // Tax Auto-Prediction Helper (Interstate vs Intra-state)
  const getTaxPrediction = () => {
    if (!taxRegNo) return { isInterState: false, cgst: 9, sgst: 9, igst: 0 };
    const ourStateCode = ourGstin.trim().substring(0, 2);
    const customerStateCode = taxRegNo.trim().replace(/^GSTIN-/, '').substring(0, 2);
    const isInterState = ourStateCode !== customerStateCode && customerStateCode.length === 2 && !isNaN(customerStateCode);
    if (isInterState) {
      return {
        isInterState: true,
        cgst: 0,
        sgst: 0,
        igst: Number(interstateGstRate)
      };
    } else {
      return {
        isInterState: false,
        cgst: 9,
        sgst: 9,
        igst: 0
      };
    }
  };

  // Tax calculations
  let subtotal = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;

  const prediction = getTaxPrediction();

  items.forEach(it => {
    if (!it.productId) return;
    const prod = products.find(p => p.id === it.productId);
    if (!prod) return;

    const qty = Number(it.quantity) || 0;
    const rate = Number(it.unitPrice) || 0;
    const disc = Number(it.discount) || 0;
    const itemSubtotal = (rate - disc) * qty;
    subtotal += itemSubtotal;

    if (collectTax) {
      const cgstRate = prediction.cgst;
      const sgstRate = prediction.sgst;
      const igstRate = prediction.igst;

      if (taxType === 'Exclusive') {
        totalCGST += itemSubtotal * (cgstRate / 100);
        totalSGST += itemSubtotal * (sgstRate / 100);
        totalIGST += itemSubtotal * (igstRate / 100);
      } else {
        // Inclusive tax calculations
        const totalTaxRate = cgstRate + sgstRate + igstRate;
        const taxableVal = itemSubtotal / (1 + totalTaxRate / 100);
        totalCGST += taxableVal * (cgstRate / 100);
        totalSGST += taxableVal * (sgstRate / 100);
        totalIGST += taxableVal * (igstRate / 100);
      }
    }
  });

  const totalGST = totalCGST + totalSGST + totalIGST;
  const grandTotal = taxType === 'Exclusive' ? subtotal + totalGST : subtotal;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) {
      Swal.fire({
        title: 'Empty Order Lines',
        text: 'Please add at least one finished product item line to submit.',
        icon: 'error',
        confirmButtonColor: '#4f46e5'
      });
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
        quotationNote,
        internalNote,
        paymentTerms,
        status: orderType === 'Quotation' ? 'Quotation' : 'Confirmed',
        items: items.map(it => ({
          productId: it.productId,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount),
          deliveryDate: it.deliveryDate
        }))
      };

      const res = isEditMode 
        ? await api.put(`/orders/${id}`, payload)
        : await api.post('/orders', payload);

      // Prepare invoice receipt data
      const order = res.data;
      const customer = customers.find(c => c.id === customerId);
      
      setCreatedOrderRef(order.referenceNo);
      setInvoiceData({
        referenceNo: order.referenceNo,
        date: new Date().toLocaleDateString('en-GB'),
        customerName: customer ? customer.name : 'Valued Customer',
        customerPhone: customer ? customer.phone : 'N/A',
        customerAddress: deliveryAddress || (customer ? customer.address : 'N/A'),
        items: items.map(it => {
          const prod = products.find(p => p.id === it.productId);
          const itemSub = (Number(it.unitPrice) - Number(it.discount)) * Number(it.quantity);
          return {
            name: prod ? prod.name : 'Unknown Product',
            code: prod ? prod.code : '',
            qty: Number(it.quantity),
            price: Number(it.unitPrice),
            discount: Number(it.discount),
            cgst: collectTax ? prediction.cgst : 0,
            sgst: collectTax ? prediction.sgst : 0,
            igst: collectTax ? prediction.igst : 0,
            subtotal: itemSub
          };
        }),
        subtotal,
        totalCGST,
        totalSGST,
        totalIGST,
        totalGST,
        grandTotal,
        taxRegNo,
        taxType
      });

      setShowInvoiceModal(true);
    } catch (err) {
      Swal.fire({
        title: 'Submission Failed',
        text: err.response?.data?.error || 'Failed to submit sales order. Try again.',
        icon: 'error',
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleModalClose = () => {
    setShowInvoiceModal(false);
    navigate('/orders/list');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate__animated animate__fadeIn">
      {/* Premium Glassmorphic Header */}
      <div className="relative bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-950/40 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-800/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] rounded-3xl" />
        <div className="relative flex items-center space-x-3.5">
          <div className="p-3.5 bg-indigo-600 dark:bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-600/10 dark:shadow-indigo-500/10">
            <ShoppingCart className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center">
              {isEditMode ? `Edit Sales Order Spec: ${createdOrderRef || 'Spec'}` : 'Configure Customer Sales Order'}
            </h1>
            <p className="text-xs text-slate-505 dark:text-slate-400 mt-1 max-w-xl">
              Create Quotations, Sales Orders, or Tax Invoices with inline stock checks, CGST/SGST/IGST tax prediction, and instant receipt generation.
            </p>
          </div>
        </div>
        <div className="relative flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/orders/list')}
            className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs py-2 px-4 font-bold"
          >
            Cancel
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Order Setup Details Card */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-2 border-b dark:border-slate-800 pb-3">
              <Compass className="w-4 h-4 text-indigo-550 dark:text-indigo-400" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-350">1. Order Identity & Parameters</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Customer Name *</label>
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
                  triggerClassName="h-10 text-xs font-semibold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Order Type</label>
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
                  triggerClassName="h-10 text-xs font-semibold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <DatePicker
                label="Order Timestamp *"
                required
                showTime
                value={orderDate}
                onChange={setOrderDate}
                modalTitle="Select Timestamp"
                placeholder="Select date"
                className="space-y-1"
                labelClassName="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase"
                triggerClassName="h-10 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white w-full"
              />

              <DatePicker
                label="Required Delivery Date *"
                required
                value={deliveryDate ? new Date(deliveryDate) : null}
                onChange={(date) => setDeliveryDate(date ? date.toISOString().split('T')[0] : '')}
                modalTitle="Select Delivery Date"
                placeholder="Select date"
                className="space-y-1"
                labelClassName="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase"
                triggerClassName="h-10 text-xs text-slate-900 dark:text-white w-full"
              />

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Customer GSTIN No</label>
                <Input
                  placeholder="GSTIN"
                  value={taxRegNo}
                  onChange={(e) => setTaxRegNo(e.target.value)}
                  className="h-10 text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-white"
                />
              </div>

              {/* Dynamic Theme Friendly Color-Coded Payment Terms dropdown button */}
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
                  triggerClassName={`h-10 text-xs font-bold border rounded-xl transition-all ${
                    paymentTerms === 'Paid'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60'
                      : paymentTerms === 'Advance Payment'
                      ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/60'
                      : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Delivery / Shipping Address</label>
                <Input
                  placeholder="Specify destination address if separate..."
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="h-10 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Quotation notes (Printed)</label>
                <Input
                  placeholder="Notes visible on printable client sheets..."
                  value={quotationNote}
                  onChange={(e) => setQuotationNote(e.target.value)}
                  className="h-10 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Internal Production Notes</label>
                <Input
                  placeholder="Notes for logistics or laboratory QC check teams..."
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  className="h-10 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Premium GST settings panel wrapper */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-6 items-center justify-between">
              <div className="flex flex-wrap gap-6 items-center">
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-555 dark:text-slate-400 block uppercase px-1">Collect Tax:</span>
                  <button
                    type="button"
                    onClick={() => setCollectTax(!collectTax)}
                    className={`px-3 py-1 text-2xs font-extrabold rounded-lg transition-all cursor-pointer ${
                      collectTax ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {collectTax ? 'ACTIVE (GST)' : 'DISABLED'}
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-555 dark:text-slate-400 block uppercase px-1">Tax Type:</span>
                  <button
                    type="button"
                    onClick={() => setTaxType(taxType === 'Exclusive' ? 'Inclusive' : 'Exclusive')}
                    className="px-3 py-1 text-2xs font-extrabold rounded-lg bg-indigo-50 dark:bg-slate-900 text-indigo-650 dark:text-indigo-400 border border-indigo-200/40 dark:border-indigo-800 transition-all cursor-pointer"
                  >
                    {taxType} Tax Basis
                  </button>
                </div>

                {collectTax && (
                  <div className="flex items-center gap-3 bg-slate-50/60 dark:bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-200/40 dark:border-slate-800 text-xs">
                    <span className="font-extrabold text-slate-500 dark:text-slate-400 uppercase text-[9px]">Supply Target:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-2xs">
                      {prediction.isInterState ? '🇮🇳 INTER-STATE (IGST Supply)' : '🏢 INTRA-STATE (CGST + SGST Supply)'}
                    </span>
                    {prediction.isInterState ? (
                      <div className="flex items-center gap-1.5 ml-2 border-l pl-2 border-slate-200 dark:border-slate-800">
                        <span className="text-[9px] text-slate-550 dark:text-slate-400 font-bold uppercase">IGST:</span>
                        <select
                          value={interstateGstRate}
                          onChange={(e) => setInterstateGstRate(Number(e.target.value))}
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-1 py-0.5 font-bold font-mono text-3xs focus:outline-none text-slate-900 dark:text-white"
                        >
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </div>
                    ) : (
                      <span className="font-extrabold font-mono text-[10px] bg-indigo-50 dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-lg border border-indigo-100/50 dark:border-indigo-900/40">
                        18% Total (9% CGST + 9% SGST)
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="text-3xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                ERP Billing GSTIN: <span className="text-slate-655 dark:text-slate-205 font-mono font-bold ml-1">{ourGstin}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Lines Card - OVERFLOW AND Z-INDEX SAFE CARD GRID LAYOUT */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 shadow-md rounded-2xl overflow-visible">
          <CardContent className="p-6 space-y-5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-500 animate-pulse" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-350">2. Customer Order Item Lines</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 rounded-xl text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> Add Item Line
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {items.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 dark:text-slate-500 italic font-medium border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                  No product item lines added. Click "Add Item Line" above to construct the sales order.
                </div>
              ) : (
                items.map((item, idx) => {
                  const prod = products.find(p => p.id === item.productId);
                  const qty = Number(item.quantity) || 0;
                  const rate = Number(item.unitPrice) || 0;
                  const disc = Number(item.discount) || 0;

                  const lineSubtotal = (rate - disc) * qty;
                  const lineCost = prod ? Number(prod.totalCost || 0) * qty : 0;
                  const lineProfit = lineSubtotal - lineCost;
                  const sufficiency = stockSufficiency[item.productId];

                  return (
                    <div key={idx} className="relative p-5 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-4 animate__animated animate__fadeInUp">
                      {/* Top Row: Title, Product Selector & Remove */}
                      <div className="flex justify-between items-center gap-3">
                        <div className="flex items-center gap-2.5 flex-1">
                          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-650 dark:text-indigo-400 font-extrabold text-xs">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <SearchSelect
                              value={item.productId}
                              onChange={(val) => handleItemChange(idx, 'productId', val)}
                              options={products.map(p => ({
                                value: p.id,
                                label: p.name,
                                subLabel: p.code || null
                              }))}
                              placeholder="Choose Ice Cream Product..."
                              searchPlaceholder="Search product name..."
                              required
                              size="sm"
                              triggerClassName="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-rose-500 hover:text-rose-650 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg p-1.5 cursor-pointer shrink-0"
                          onClick={() => handleRemoveItem(idx)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Middle Row: Quantity, Price, Discount Inputs */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Quantity</label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg h-9 text-slate-900 dark:text-white"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Unit Price (₹)</label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                            className="font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg h-9 text-slate-900 dark:text-white"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Discount (₹)</label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.discount}
                            onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                            className="font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg h-9 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      {/* Bottom Row: Delivery Date, Stock Info */}
                      <div className="grid grid-cols-2 gap-3 items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Delivery Date</label>
                          <DatePicker
                            value={item.deliveryDate ? new Date(item.deliveryDate) : null}
                            onChange={(date) => handleItemChange(idx, 'deliveryDate', date ? date.toISOString().split('T')[0] : '')}
                            modalTitle="Line Delivery Date"
                            placeholder="Select Date"
                            className="w-full space-y-0"
                            triggerClassName="h-9 text-xs p-2 font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                          />
                        </div>
                        <div className="space-y-1 text-right">
                          <label className="text-[9px] font-bold text-slate-550 dark:text-slate-400 uppercase block mb-1">Availability Status</label>
                          {sufficiency ? (
                            <span className={`inline-flex px-2.5 py-1 text-[9px] font-extrabold rounded-lg uppercase border ${
                              sufficiency.status === 'Sufficient'
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-450 border-emerald-100/50 dark:border-emerald-900/30'
                                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-450 border-amber-100/50 dark:border-amber-900/30'
                            }`}>
                              {sufficiency.status === 'Sufficient' ? 'In Stock' : `Short: ${sufficiency.shortage}`}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold text-[10px]">Checking stock...</span>
                          )}
                        </div>
                      </div>

                      {/* Line calculations breakdown summary */}
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs font-mono">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">Line Subtotal</span>
                          <span className="font-extrabold text-slate-800 dark:text-white">₹{lineSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">Estimated Profit</span>
                          <span className={`font-extrabold ${lineProfit >= 0 ? 'text-emerald-600 dark:text-emerald-450' : 'text-rose-600 dark:text-rose-455'}`}>
                            ₹{lineProfit.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live Estimations & Checkout Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Live Estimations */}
          <div className="md:col-span-2 bg-gradient-to-br from-slate-50 to-slate-105/30 dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-800 dark:text-white flex items-center text-sm">
                <Info className="w-5 h-5 mr-1.5 text-indigo-500" /> Production Lead-time & Estimate Checks
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Values are dynamically calculated from formulation recipe structures.</p>
            </div>

            {estimates ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mt-3">
                <div className="p-4 bg-slate-55 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold block uppercase tracking-wider mb-1">Estimated Cost to Produce:</span>
                  <span className="font-extrabold text-slate-800 dark:text-white font-mono text-base">₹{estimates.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="p-4 bg-slate-55 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold block uppercase tracking-wider mb-1">Est. Completion Lead-time:</span>
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400 font-mono text-xs">{new Date(estimates.estimatedCompletionDate).toLocaleString()}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const dt = new Date(estimates.estimatedCompletionDate).toISOString().split('T')[0];
                      setDeliveryDate(dt);
                    }}
                    className="mt-2 text-3xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold underline cursor-pointer block uppercase tracking-wide"
                  >
                    Apply as Delivery Date
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-6 text-center border border-dashed rounded-xl bg-white dark:bg-slate-850/20 border-slate-200 dark:border-slate-800">
                Add finished product lines to estimate production duration and costings.
              </div>
            )}
          </div>

          {/* Totals Summary checkout */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
            <div className="space-y-2 border-b dark:border-slate-800 pb-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Order Subtotal:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-350">₹{subtotal.toFixed(2)}</span>
              </div>
              {collectTax && (
                <div className="space-y-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl mt-1.5 border border-slate-200/50 dark:border-slate-800">
                  <div className="flex justify-between items-center text-3xs text-slate-500 dark:text-slate-400">
                    <span>CGST Amount:</span>
                    <span className="font-mono">₹{totalCGST.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-3xs text-slate-500 dark:text-slate-400">
                    <span>SGST Amount:</span>
                    <span className="font-mono">₹{totalSGST.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-3xs text-slate-550 dark:text-slate-400">
                    <span>IGST Amount:</span>
                    <span className="font-mono">₹{totalIGST.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center bg-indigo-50/20 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-100/40 dark:border-indigo-900/30">
              <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-extrabold uppercase tracking-wide">Net Pay Total:</span>
              <span className="text-xl font-extrabold text-indigo-650 dark:text-indigo-400 font-mono">₹{grandTotal.toFixed(2)}</span>
            </div>

            <Button
              type="submit"
              disabled={submitting || items.length === 0 || !customerId}
              className="w-full bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-extrabold py-3 rounded-xl shadow-md transition-all cursor-pointer h-11 flex items-center justify-center text-xs"
            >
              {submitting ? 'Submitting Order Specs...' : isEditMode ? 'Save Modifications' : 'Place Order & Print Receipt'}
            </Button>
          </div>
        </div>
      </form>

      {/* Tax Invoice Modal Overlay (Printable Premium Receipt Card) */}
      {showInvoiceModal && invoiceData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate__animated animate__fadeIn">
          <div className="bg-white text-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl p-8 space-y-6 relative border border-slate-200">
            <button
              onClick={handleModalClose}
              className="absolute right-6 top-6 text-slate-400 hover:text-slate-650 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Print Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6">
              <div>
                <h2 className="text-xl font-black text-indigo-600 uppercase flex items-center gap-1.5 tracking-tight">
                  <Sparkles className="w-5 h-5" /> Kulfi & Icecream ERP
                </h2>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-1">Quality Ice Cream Manufacturing Hub</p>
                <p className="text-2xs text-slate-400 font-mono mt-0.5">GSTIN: {ourGstin}</p>
              </div>
              <div className="text-left sm:text-right">
                <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-lg inline-block">Tax Invoice</h3>
                <p className="text-xs font-bold font-mono text-slate-900 mt-2">Invoice No: {invoiceData.referenceNo}</p>
                <p className="text-2xs text-slate-400">Date: {invoiceData.date}</p>
              </div>
            </div>

            {/* Bill To & Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/80 p-5 rounded-2xl text-xs border border-slate-200/50">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Billed To Customer</span>
                <p className="font-extrabold text-slate-800 text-sm">{invoiceData.customerName}</p>
                {invoiceData.customerPhone !== 'N/A' && <p className="text-slate-600 font-mono">Phone: {invoiceData.customerPhone}</p>}
                <p className="text-slate-600 leading-relaxed">Address: {invoiceData.customerAddress}</p>
              </div>
              <div className="text-left sm:text-right space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Payment & Logistics Info</span>
                <p className="text-slate-700">Order Type: <span className="font-bold text-slate-800">{orderType}</span></p>
                <p className="text-slate-700">Payment Terms: <span className="font-bold text-indigo-650">{paymentTerms}</span></p>
                <p className="text-slate-700">Tax Type: <span className="font-bold text-slate-800">{invoiceData.taxType} GST</span></p>
                <p className="text-slate-700">GST Registration: <span className="font-bold font-mono text-slate-800">{invoiceData.taxRegNo}</span></p>
              </div>
            </div>

            {/* Invoice Line Items */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[700px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold border-b border-slate-200">
                    <th className="px-4 py-2.5 text-center w-12 font-bold">SN</th>
                    <th className="px-4 py-2.5">Item Details</th>
                    <th className="px-4 py-2.5 text-right w-16">Qty</th>
                    <th className="px-4 py-2.5 text-right w-24">Rate</th>
                    <th className="px-4 py-2.5 text-right w-20">Discount</th>
                    <th className="px-4 py-2.5 text-right w-28">Taxable Val</th>
                    {collectTax && (
                      <>
                        <th className="px-4 py-2.5 text-right w-24">CGST</th>
                        <th className="px-4 py-2.5 text-right w-24">SGST</th>
                        <th className="px-4 py-2.5 text-right w-24">IGST</th>
                      </>
                    )}
                    <th className="px-4 py-2.5 text-right w-32">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {invoiceData.items.map((item, idx) => {
                    const taxableVal = invoiceData.taxType === 'Exclusive' 
                      ? item.subtotal 
                      : item.subtotal / (1 + (item.cgst + item.sgst + item.igst) / 100);

                    const cgstAmt = taxableVal * (item.cgst / 100);
                    const sgstAmt = taxableVal * (item.sgst / 100);
                    const igstAmt = taxableVal * (item.igst / 100);
                    const lineTotal = invoiceData.taxType === 'Exclusive' 
                      ? item.subtotal + cgstAmt + sgstAmt + igstAmt 
                      : item.subtotal;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {item.name} <span className="text-[10px] text-slate-450 font-mono">({item.code})</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{item.qty}</td>
                        <td className="px-4 py-3 text-right font-mono">₹{item.price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">₹{item.discount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">₹{taxableVal.toFixed(2)}</td>
                        {collectTax && (
                          <>
                            <td className="px-4 py-3 text-right font-mono text-slate-500">₹{cgstAmt.toFixed(2)} ({item.cgst}%)</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500">₹{sgstAmt.toFixed(2)} ({item.sgst}%)</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500">₹{igstAmt.toFixed(2)} ({item.igst}%)</td>
                          </>
                        )}
                        <td className="px-4 py-3 text-right font-extrabold text-slate-900 font-mono">
                          ₹{lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Calculations Breakdown Summary */}
            <div className="flex justify-end pt-4 border-t">
              <div className="w-80 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span className="font-semibold">Subtotal Amount:</span>
                  <span className="font-mono">₹{invoiceData.subtotal.toFixed(2)}</span>
                </div>
                {collectTax && (
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/50">
                    <div className="flex justify-between text-slate-500 text-3xs">
                      <span>Total CGST:</span>
                      <span className="font-mono">₹{invoiceData.totalCGST.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-3xs">
                      <span>Total SGST:</span>
                      <span className="font-mono">₹{invoiceData.totalSGST.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-3xs">
                      <span>Total IGST:</span>
                      <span className="font-mono">₹{invoiceData.totalIGST.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-indigo-650 border-t pt-2.5">
                  <span className="uppercase">Net Grand Total:</span>
                  <span className="font-mono text-base">₹{invoiceData.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 justify-end pt-4 border-t print:hidden">
              <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold px-6 py-2 rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer">
                <Printer className="w-4 h-4" /> Print Tax Invoice
              </Button>
              <Button onClick={handleModalClose} variant="outline" className="px-6 py-2 rounded-xl text-xs font-bold cursor-pointer">
                Close & Go to Order Registry
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
