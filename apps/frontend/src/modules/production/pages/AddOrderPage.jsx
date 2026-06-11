import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { ShoppingCart, PlusCircle, Trash2, Info, Printer, X, Check, AlertTriangle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import SearchSelect from '@/components/ui/SearchSelect';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';

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
  
  // Tax Configuration (Image 4 inspired)
  const [collectTax, setCollectTax] = useState(true);
  const [taxRegNo, setTaxRegNo] = useState('GSTIN-27AABC1234F1Z5');
  const [taxType, setTaxType] = useState('Exclusive'); // Exclusive or Inclusive
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

    // Load tax configurations
    const saved = localStorage.getItem('kulfi_erp_tax_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCollectTax(parsed.collectTax === 'Yes');
        if (parsed.taxRegNo) setTaxRegNo(parsed.taxRegNo);
        if (parsed.taxType) setTaxType(parsed.taxType.replace(' Tax', ''));
        
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

  // Tax calculations
  let subtotal = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;

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
      const cgstRate = Number(prod.cgst || 9);
      const sgstRate = Number(prod.sgst || 9);
      const igstRate = Number(prod.igst || 9);

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
      alert('Please add at least one item');
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
            cgst: collectTax ? Number(prod?.cgst || 9) : 0,
            sgst: collectTax ? Number(prod?.sgst || 9) : 0,
            igst: collectTax ? Number(prod?.igst || 9) : 0,
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
      alert(err.response?.data?.error || 'Failed to submit order');
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Panel */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
          <ShoppingCart className="w-6 h-6 mr-2 text-indigo-600" />
          Add Customer Order
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Create Sales Orders, Quotations, and Tax Invoices with integrated GST rates and printable receipts.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Order Setup Details */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Customer *</label>
              <SearchSelect
                value={customerId}
                onChange={setCustomerId}
                options={customers.map(c => ({
                  value: c.id,
                  label: c.name,
                  subLabel: c.phone || null
                }))}
                placeholder="Select customer..."
                searchPlaceholder="Search customer name or phone..."
                required
                triggerClassName="h-10 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Order Type</label>
              <SearchSelect
                value={orderType}
                onChange={setOrderType}
                options={[
                  { value: 'Sales Order', label: 'Sales Order' },
                  { value: 'Quotation', label: 'Quotation' },
                  { value: 'Invoice', label: 'Invoice' }
                ]}
                showSearch={false}
                placeholder="Select type..."
                required
                triggerClassName="h-10 text-sm"
              />
            </div>

            <DatePicker
              label="Order Date & Time"
              required
              showTime
              value={orderDate}
              onChange={setOrderDate}
              modalTitle="Order Date & Time"
              placeholder="Select Date & Time"
              className="space-y-1"
              labelClassName="text-xs font-semibold text-slate-500 uppercase block"
              triggerClassName="h-10 text-sm"
            />

            <DatePicker
              label="Delivery Date"
              required
              value={deliveryDate ? new Date(deliveryDate) : null}
              onChange={(date) => setDeliveryDate(date ? date.toISOString().split('T')[0] : '')}
              modalTitle="Delivery Date"
              placeholder="Select Date"
              className="space-y-1"
              labelClassName="text-xs font-semibold text-slate-500 uppercase block"
              triggerClassName="h-10 text-sm"
            />

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">GSTIN Registration</label>
              <Input
                placeholder="GSTIN"
                value={taxRegNo}
                onChange={(e) => setTaxRegNo(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Delivery Address</label>
              <Input
                placeholder="Shipping address if different from default..."
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Quotation Notes</label>
              <Input
                placeholder="Visible to customer..."
                value={quotationNote}
                onChange={(e) => setQuotationNote(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Internal Notes</label>
              <Input
                placeholder="Notes for production or logistics..."
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
              />
            </div>
          </div>

          {/* Tax Parameters (Image 4 features) */}
          <div className="pt-3 border-t dark:border-slate-700 flex flex-wrap gap-6 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">Collect Tax:</span>
              <button
                type="button"
                onClick={() => setCollectTax(!collectTax)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                  collectTax ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-350'
                }`}
              >
                {collectTax ? 'YES' : 'NO'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">Tax Type:</span>
              <button
                type="button"
                onClick={() => setTaxType(taxType === 'Exclusive' ? 'Inclusive' : 'Exclusive')}
                className="px-3 py-1 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 border border-indigo-200 dark:border-indigo-800"
              >
                {taxType} Tax
              </button>
            </div>
          </div>
        </div>

        {/* Order lines editor */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Order Item Lines</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="flex items-center gap-1.5 rounded-xl text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
            >
              <PlusCircle className="w-4 h-4" /> Add Item Line
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-3 py-3 w-12 text-center">SN</th>
                  <th className="px-3 py-3">Product Name</th>
                  <th className="px-3 py-3 text-right w-24">Quantity</th>
                  <th className="px-3 py-3 text-right w-28">Unit Price</th>
                  <th className="px-3 py-3 text-right w-28">Discount</th>
                  <th className="px-3 py-3 text-right">Subtotal</th>
                  <th className="px-3 py-3 text-right">Est. Cost</th>
                  <th className="px-3 py-3 text-right">Est. Profit</th>
                  <th className="px-3 py-3 text-center">Stock Info</th>
                  <th className="px-3 py-3 text-center w-24">Delivery</th>
                  <th className="px-3 py-3 text-center w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-slate-450 dark:text-slate-400">
                      No order lines added. Click "Add Item Line" above to construct the sales order.
                    </td>
                  </tr>
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
                      <tr key={idx} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10">
                        <td className="px-3 py-3 text-center font-medium text-slate-400">{idx + 1}</td>
                        <td className="px-2 py-2 min-w-[200px]">
                          <SearchSelect
                            value={item.productId}
                            onChange={(val) => handleItemChange(idx, 'productId', val)}
                            options={products.map(p => ({
                              value: p.id,
                              label: p.name,
                              subLabel: p.code || null
                            }))}
                            placeholder="Select Product"
                            searchPlaceholder="Search product..."
                            required
                            size="sm"
                            triggerClassName="w-full text-xs font-semibold"
                          />
                        </td>

                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="text-right font-mono text-xs"
                            required
                          />
                        </td>

                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                            className="text-right font-mono text-xs"
                            required
                          />
                        </td>

                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.discount}
                            onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                            className="text-right font-mono text-xs"
                          />
                        </td>

                        <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-white font-mono">
                          ₹{lineSubtotal.toFixed(2)}
                        </td>

                        <td className="px-3 py-2 text-right text-slate-500 dark:text-slate-400 font-mono text-xs">
                          ₹{lineCost.toFixed(2)}
                        </td>

                        <td className={`px-3 py-2 text-right font-semibold font-mono text-xs ${lineProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          ₹{lineProfit.toFixed(2)}
                        </td>

                        <td className="px-2 py-2 text-center">
                          {sufficiency ? (
                            <span className={`inline-flex px-2 py-0.5 text-2xs font-bold rounded-full ${
                              sufficiency.status === 'Sufficient'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                            }`}>
                              {sufficiency.status === 'Sufficient' ? 'In Stock' : `Short: ${sufficiency.shortage}`}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-2xs">Checking...</span>
                          )}
                        </td>

                        <td className="px-2 py-2">
                          <DatePicker
                            value={item.deliveryDate ? new Date(item.deliveryDate) : null}
                            onChange={(date) => handleItemChange(idx, 'deliveryDate', date ? date.toISOString().split('T')[0] : '')}
                            modalTitle="Item Delivery Date"
                            placeholder="Date"
                            className="w-24 space-y-0"
                            triggerClassName="h-8 text-xs p-1 font-mono rounded-lg"
                          />
                        </td>

                        <td className="px-2 py-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                            onClick={() => handleRemoveItem(idx)}
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* Live Estimations & Checkout Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Live Estimations */}
          <div className="md:col-span-2 bg-slate-50 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center">
                <Info className="w-5 h-5 mr-1.5 text-indigo-500" /> Production Estimate & Lead-time Checks
              </h3>
              <p className="text-xs text-slate-400">Live estimates computed from stage timelines and product cost matrices.</p>
            </div>

            {estimates ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-2xs">
                  <span className="text-xs text-slate-450 block">Estimated Production Cost:</span>
                  <span className="font-bold text-slate-900 dark:text-white">₹{estimates.totalCost.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-2xs">
                  <span className="text-xs text-slate-450 block">Est. Completion Lead-time:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{new Date(estimates.estimatedCompletionDate).toLocaleString()}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const dt = new Date(estimates.estimatedCompletionDate).toISOString().split('T')[0];
                      setDeliveryDate(dt);
                    }}
                    className="mt-1 text-2xs text-indigo-600 hover:text-indigo-850 font-bold underline cursor-pointer block"
                  >
                    Apply as Delivery Date
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">Add order items to inspect production cost and timeline estimates.</div>
            )}
          </div>

          {/* Totals Box */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
            <div className="space-y-2 border-b dark:border-slate-700 pb-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-450">Order Subtotal</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">₹{subtotal.toFixed(2)}</span>
              </div>
              {collectTax && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-450">CGST Amount</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">₹{totalCGST.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-450">SGST Amount</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">₹{totalSGST.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-450">IGST Amount</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">₹{totalIGST.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-450 uppercase font-bold">Total (With GST)</span>
              <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">₹{grandTotal.toFixed(2)}</span>
            </div>

            <Button
              type="submit"
              disabled={submitting || items.length === 0 || !customerId}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors"
            >
              {submitting ? 'Saving Order...' : isEditMode ? 'Update Order' : 'Confirm & Save Order'}
            </Button>
          </div>
        </div>
      </form>

      {/* Tax Invoice Modal Overlay (Image 4 Printable Receipt) */}
      {showInvoiceModal && invoiceData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white text-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl p-8 space-y-6 relative border border-slate-200">
            <button
              onClick={handleModalClose}
              className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Print Header */}
            <div className="flex justify-between border-b pb-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-indigo-600 uppercase">Kulfi ERP System Ltd.</h2>
                <p className="text-xs text-slate-500">12, Ice Cream Industrial Zone, Mumbai, Maharashtra</p>
                <p className="text-xs text-slate-500">GSTIN: {invoiceData.taxRegNo}</p>
              </div>
              <div className="text-right">
                <h3 className="text-xl font-bold text-slate-700">TAX INVOICE</h3>
                <p className="text-sm font-semibold font-mono">Invoice No: {invoiceData.referenceNo}</p>
                <p className="text-xs text-slate-500">Date: {invoiceData.date}</p>
              </div>
            </div>

            {/* Bill To & Details */}
            <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl text-sm">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase block">Billed To</span>
                <p className="font-bold text-slate-800">{invoiceData.customerName}</p>
                <p className="text-slate-600">Phone: {invoiceData.customerPhone}</p>
                <p className="text-slate-600">Address: {invoiceData.customerAddress}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 font-bold uppercase block">Payment / Order Info</span>
                <p className="text-slate-700">Order Type: <span className="font-bold">{orderType}</span></p>
                <p className="text-slate-700">Tax Basis: <span className="font-bold">{invoiceData.taxType} GST</span></p>
                <p className="text-slate-700">Status: <span className="font-bold text-emerald-600">CONFIRMED</span></p>
              </div>
            </div>

            {/* Invoice Line Items */}
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-xs uppercase font-bold border-b">
                  <th className="px-4 py-2 text-center w-12">SN</th>
                  <th className="px-4 py-2">Item Details</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Rate</th>
                  <th className="px-4 py-2 text-right">Discount</th>
                  <th className="px-4 py-2 text-right">Taxable Value</th>
                  {collectTax && (
                    <>
                      <th className="px-4 py-2 text-right">CGST</th>
                      <th className="px-4 py-2 text-right">SGST</th>
                      <th className="px-4 py-2 text-right">IGST</th>
                    </>
                  )}
                  <th className="px-4 py-2 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
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
                      <td className="px-4 py-3 text-center">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {item.name} <span className="text-2xs text-slate-400">({item.code})</span>
                      </td>
                      <td className="px-4 py-3 text-right">{item.qty}</td>
                      <td className="px-4 py-3 text-right">₹{item.price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">₹{item.discount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">₹{taxableVal.toFixed(2)}</td>
                      {collectTax && (
                        <>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">₹{cgstAmt.toFixed(2)} ({item.cgst}%)</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">₹{sgstAmt.toFixed(2)} ({item.sgst}%)</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">₹{igstAmt.toFixed(2)} ({item.igst}%)</td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono">
                        ₹{lineTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Calculations Breakdown Summary */}
            <div className="flex justify-end pt-4 border-t">
              <div className="w-80 space-y-2 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal Amount:</span>
                  <span className="font-mono">₹{invoiceData.subtotal.toFixed(2)}</span>
                </div>
                {collectTax && (
                  <>
                    <div className="flex justify-between text-slate-500">
                      <span>Total CGST:</span>
                      <span className="font-mono">₹{invoiceData.totalCGST.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Total SGST:</span>
                      <span className="font-mono">₹{invoiceData.totalSGST.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Total IGST:</span>
                      <span className="font-mono">₹{invoiceData.totalIGST.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-base font-bold text-indigo-600 border-t pt-2">
                  <span>Grand Total (Net):</span>
                  <span className="font-mono text-lg">₹{invoiceData.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 justify-end pt-4 border-t print:hidden">
              <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl flex items-center gap-1.5 shadow-md">
                <Printer className="w-4 h-4" /> Print Invoice
              </Button>
              <Button onClick={handleModalClose} variant="outline" className="px-6 py-2 rounded-xl">
                Close Invoice & Go Back
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
