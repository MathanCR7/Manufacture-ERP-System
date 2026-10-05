import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, ArrowLeft, Sun, Moon } from 'lucide-react';
import { api } from '@/lib/axios';

// Sample demo items specified in SAP B1 prompt + complete fallback
const DEFAULT_CATALOG = [
  { code: 'K101', desc: 'Kulfi Traditional Desi Malai 42CAV 50ML', price: 20.00, gst: 5 },
  { code: 'K106', desc: 'Kulfi Traditional Chocolate 42CAV 50ML', price: 26.00, gst: 5 },
  { code: 'K105', desc: 'Kulfi Traditional Malai Badam 42CAV 50ML', price: 26.00, gst: 5 },
  { code: 'K160', desc: 'Kulfi Assorted Kaju Katli 42CAV 50ML', price: 30.00, gst: 5 },
  { code: 'K116', desc: 'Kulfi Assorted Rose Gulkanda 42CAV 50ML', price: 26.00, gst: 5 },
  { code: 'P117', desc: 'Popsicle Regular Blueberry 50CAV 40ML', price: 32.00, gst: 5 },
  { code: 'P113', desc: 'Popsicle Regular Mango 50CAV 40ML', price: 32.00, gst: 5 },
  { code: 'P114', desc: 'Popsicle Regular Strawberry 50CAV 40ML', price: 32.00, gst: 5 },
];

function formatINR(val) {
  if (typeof val !== 'number' || isNaN(val)) return '0.00';
  const isNeg = val < 0;
  const absVal = Math.abs(val);
  const fixed = absVal.toFixed(2);
  const parts = fixed.split('.');
  let intPart = parts[0];
  const decPart = parts[1];

  if (intPart.length > 3) {
    const lastThree = intPart.substring(intPart.length - 3);
    const remaining = intPart.substring(0, intPart.length - 3);
    intPart = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }
  return (isNeg ? '-' : '') + intPart + '.' + decPart;
}

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function SalesOrderSAPPage() {
  const navigate = useNavigate();

  // Local/Internal Theme Toggle for SAP window
  const [sapTheme, setSapTheme] = useState('light');

  // Load product catalog (combines live backend items with fallback)
  const [catalog, setCatalog] = useState(DEFAULT_CATALOG);

  useEffect(() => {
    api.get('/products/search', { params: { limit: 500 } })
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const mapped = res.data.map(p => ({
            code: p.code,
            desc: p.description || p.name,
            price: Number(p.salePrice || 0),
            gst: Number(p.gstRate || 5)
          }));
          setCatalog(mapped);
        }
      })
      .catch(() => {
        // Fallback already set
      });
  }, []);

  const catalogMap = useMemo(() => {
    const map = new Map();
    catalog.forEach(it => {
      map.set(it.code.toUpperCase(), it);
    });
    return map;
  }, [catalog]);

  // Order Header States
  const [customer, setCustomer] = useState('WALK-IN');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [customerRefNo, setCustomerRefNo] = useState('');
  const [currency] = useState('INR');

  const [orderCounter, setOrderCounter] = useState(1);
  const orderNumberStr = useMemo(() => `SO-${String(orderCounter).padStart(5, '0')}`, [orderCounter]);
  const [status] = useState('Open');

  const [postingDate, setPostingDate] = useState(() => formatDate(new Date()));
  const [docDate, setDocDate] = useState(() => formatDate(new Date()));
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const tm = new Date();
    tm.setDate(tm.getDate() + 1);
    return formatDate(tm);
  });

  // Active Tab
  const [activeTab, setActiveTab] = useState('contents'); // 'contents', 'advance', 'remarks'

  // Item Grid State
  const [rows, setRows] = useState([
    { id: '1', itemCode: '', desc: '', qty: '', price: 0, disc: 0, gst: 5, totalLC: 0 }
  ]);

  // Advance Tab State
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [advanceReceived, setAdvanceReceived] = useState('');

  // Remarks Tab State
  const [remarks, setRemarks] = useState('');

  // Bottom Left
  const [salesEmployee, setSalesEmployee] = useState('none');
  const [owner] = useState('Counter 1');

  // Message Bar State
  const [message, setMessage] = useState({ text: '', type: '' }); // type: 'error' | 'success'

  // In-memory saved orders
  const [ordersHistory, setOrdersHistory] = useState([]);

  // Recalculate Totals
  const totals = useMemo(() => {
    let grossSum = 0;
    let discSum = 0;
    let taxSum = 0;

    rows.forEach(r => {
      const q = parseFloat(r.qty) || 0;
      const p = parseFloat(r.price) || 0;
      const dPct = Math.min(100, Math.max(0, parseFloat(r.disc) || 0));
      const gPct = parseFloat(r.gst) || 0;

      const gross = q * p;
      const disc = gross * (dPct / 100);
      const net = gross - disc;
      const lineTax = net * (gPct / 100);

      grossSum += gross;
      discSum += disc;
      taxSum += lineTax;
    });

    const rawTotal = grossSum - discSum + taxSum;
    const paymentDue = Math.round(rawTotal);
    const rounding = paymentDue - rawTotal;

    const advNum = parseFloat(advanceReceived) || 0;
    const balanceDue = Math.max(0, paymentDue - advNum);

    return {
      beforeDisc: grossSum,
      discount: discSum,
      tax: taxSum,
      rawTotal,
      paymentDue,
      rounding,
      balanceDue
    };
  }, [rows, advanceReceived]);

  // Handlers for Row editing
  const handleItemCodeChange = (idx, code) => {
    const cleanCode = code.trim().toUpperCase();
    const updated = [...rows];
    const targetRow = { ...updated[idx], itemCode: cleanCode };

    const matched = catalogMap.get(cleanCode);
    if (matched) {
      targetRow.desc = matched.desc;
      targetRow.price = matched.price;
      targetRow.gst = matched.gst || 5;
      if (targetRow.qty === '' || parseFloat(targetRow.qty) === 0) {
        targetRow.qty = 1;
      }
    } else {
      targetRow.desc = '';
    }

    const q = parseFloat(targetRow.qty) || 0;
    const p = parseFloat(targetRow.price) || 0;
    const dPct = Math.min(100, Math.max(0, parseFloat(targetRow.disc) || 0));
    targetRow.totalLC = (q * p) * (1 - dPct / 100);

    updated[idx] = targetRow;

    // Auto-add empty row if editing last row
    if (idx === updated.length - 1 && cleanCode !== '') {
      updated.push({
        id: Math.random().toString(36).substr(2, 9),
        itemCode: '',
        desc: '',
        qty: '',
        price: 0,
        disc: 0,
        gst: 5,
        totalLC: 0
      });
    }

    setRows(updated);
  };

  const handleFieldChange = (idx, field, val) => {
    const updated = [...rows];
    const targetRow = { ...updated[idx], [field]: val };

    const q = parseFloat(field === 'qty' ? val : targetRow.qty) || 0;
    const p = parseFloat(field === 'price' ? val : targetRow.price) || 0;
    const dPct = Math.min(100, Math.max(0, parseFloat(field === 'disc' ? val : targetRow.disc) || 0));
    targetRow.totalLC = (q * p) * (1 - dPct / 100);

    updated[idx] = targetRow;
    setRows(updated);
  };

  const handleDeleteRow = (idx) => {
    if (rows.length <= 1) return;
    const updated = rows.filter((_, i) => i !== idx);
    setRows(updated);
  };

  const resetOrderForm = () => {
    setCustomer('WALK-IN');
    setName('');
    setMobile('');
    setCustomerRefNo('');
    const td = new Date();
    const tm = new Date();
    tm.setDate(td.getDate() + 1);
    setPostingDate(formatDate(td));
    setDocDate(formatDate(td));
    setDeliveryDate(formatDate(tm));
    setPaymentMode('Cash');
    setAdvanceReceived('');
    setRemarks('');
    setRows([
      { id: '1', itemCode: '', desc: '', qty: '', price: 0, disc: 0, gst: 5, totalLC: 0 }
    ]);
    setActiveTab('contents');
  };

  const handleAddOrder = () => {
    setMessage({ text: '', type: '' });

    // 1. At least one line has an item and Quantity greater than 0
    const validLines = rows.filter(r => r.itemCode.trim() !== '' && (parseFloat(r.qty) || 0) > 0);
    if (validLines.length === 0) {
      setMessage({ text: 'Add at least one item with a quantity.', type: 'error' });
      setActiveTab('contents');
      return;
    }

    // 2. Delivery Date is filled
    if (!deliveryDate) {
      setMessage({ text: 'Delivery date is required.', type: 'error' });
      return;
    }

    // 3. Mobile is filled
    if (!mobile.trim()) {
      setMessage({ text: "Enter the customer's mobile number so the order can be traced.", type: 'error' });
      return;
    }

    // 4. Advance received is not more than Total Payment Due
    const adv = parseFloat(advanceReceived) || 0;
    if (adv > totals.paymentDue) {
      setMessage({ text: 'Advance cannot be more than the total.', type: 'error' });
      setActiveTab('advance');
      return;
    }

    // Save order in memory
    const savedOrderNo = orderNumberStr;
    const newOrder = {
      orderNo: savedOrderNo,
      customer,
      name,
      mobile,
      customerRefNo,
      currency,
      status: 'Open',
      postingDate,
      deliveryDate,
      docDate,
      items: validLines.map(l => ({ ...l })),
      paymentMode,
      advanceReceived: adv,
      balanceDue: totals.balanceDue,
      remarks,
      salesEmployee,
      owner,
      totals: { ...totals }
    };

    setOrdersHistory(prev => [newOrder, ...prev]);
    setOrderCounter(prev => prev + 1);
    resetOrderForm();
    setMessage({ text: `${savedOrderNo} added.`, type: 'success' });
  };

  const handleCancelOrder = () => {
    resetOrderForm();
    setMessage({ text: '', type: '' });
  };

  // SAP theme colors mapped
  const themeStyles = sapTheme === 'dark' ? {
    '--bg-page': '#1a2028',
    '--bg-panel': '#222a34',
    '--border': '#3d4854',
    '--text': '#e6ebf0',
    '--text-muted': '#9aa5b1',
    '--bg-input': '#161c23',
    '--bg-readonly': '#2a323d',
    '--bg-header': '#2c3540',
    '--tab-active-bg': '#222a34',
    '--tab-inactive-bg': '#161c23',
    '--grid-row-alt': '#1f262f',
    '--btn-sec': '#2a323d',
    '--btn-sec-border': '#3d4854',
    '--btn-sec-text': '#e6ebf0',
    '--titlebar-bg': '#111827',
  } : {
    '--bg-page': '#e9edf2',
    '--bg-panel': '#f6f8fa',
    '--border': '#b9c2cd',
    '--text': '#1d2630',
    '--text-muted': '#5d6b7a',
    '--bg-input': '#ffffff',
    '--bg-readonly': '#e4e8ed',
    '--bg-header': '#dde3ea',
    '--tab-active-bg': '#ffffff',
    '--tab-inactive-bg': '#e4e8ed',
    '--grid-row-alt': '#fbfcfd',
    '--btn-sec': '#e4e8ed',
    '--btn-sec-border': '#b9c2cd',
    '--btn-sec-text': '#1d2630',
    '--titlebar-bg': '#374151',
  };

  return (
    <div
      style={{
        ...themeStyles,
        backgroundColor: 'var(--bg-page)',
        color: 'var(--text)',
        fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif',
        fontSize: '13px',
        minHeight: 'calc(100vh - 70px)',
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      {/* Top Utilities Toolbar */}
      <div style={{ width: '100%', maxWidth: '1080px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <button
          onClick={() => navigate('/sales/billing')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '3px 10px',
            fontSize: '12px',
            cursor: 'pointer',
            borderRadius: '2px'
          }}
        >
          <ArrowLeft style={{ width: '12px', height: '12px' }} /> Return to Sales
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <a
            href="/sales-order-sap-b1.html"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: '#f0b429',
              color: '#1d2630',
              fontWeight: 'bold',
              textDecoration: 'none',
              padding: '3px 10px',
              fontSize: '12px',
              border: '1px solid #d49b1a',
              borderRadius: '2px'
            }}
          >
            <ExternalLink style={{ width: '12px', height: '12px' }} /> Open Fullscreen Standalone HTML
          </a>
        </div>
      </div>

      {/* SAP Business One Window Container */}
      <div
        style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          width: '100%',
          maxWidth: '1080px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Title Bar */}
        <div
          style={{
            backgroundColor: 'var(--titlebar-bg)',
            color: '#ffffff',
            padding: '5px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12.5px',
            fontWeight: 600,
            userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Sales Order</span>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setSapTheme(sapTheme === 'light' ? 'dark' : 'light')}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.4)',
                color: '#ffffff',
                fontSize: '11px',
                padding: '2px 8px',
                cursor: 'pointer'
              }}
            >
              Theme: {sapTheme === 'light' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>

        {/* Header Section (2 Columns) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '12px 28px',
            padding: '12px 14px 10px 14px',
            borderBottom: '1px solid var(--border)'
          }}
        >
          {/* Left Column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ width: '125px', flexShrink: 0, color: 'var(--text-muted)', fontSize: '12px' }}>Customer</label>
              <input
                type="text"
                value={customer}
                onChange={e => setCustomer(e.target.value)}
                style={{ width: '100%', maxWidth: '240px', height: '22px', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ width: '125px', flexShrink: 0, color: 'var(--text-muted)', fontSize: '12px' }}>Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Customer name"
                style={{ width: '100%', maxWidth: '240px', height: '22px', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ width: '125px', flexShrink: 0, color: 'var(--text-muted)', fontSize: '12px' }}>
                Mobile <span style={{ color: '#c62828', fontWeight: 'bold' }}>*</span>
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                placeholder="10-digit number"
                style={{ width: '100%', maxWidth: '240px', height: '22px', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ width: '125px', flexShrink: 0, color: 'var(--text-muted)', fontSize: '12px' }}>Customer Ref. No.</label>
              <input
                type="text"
                value={customerRefNo}
                onChange={e => setCustomerRefNo(e.target.value)}
                style={{ width: '100%', maxWidth: '240px', height: '22px', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ width: '125px', flexShrink: 0, color: 'var(--text-muted)', fontSize: '12px' }}>Currency</label>
              <input
                type="text"
                value={currency}
                readOnly
                style={{ width: '100%', maxWidth: '240px', height: '22px', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-readonly)', color: 'var(--text)', fontSize: '12px' }}
              />
            </div>
          </div>

          {/* Right Column */}
          <div style={{ justifySelf: 'end', width: '100%', maxWidth: '370px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '4px' }}>
              <label style={{ width: '120px', textAlign: 'right', paddingRight: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>No.</label>
              <input
                type="text"
                value={orderNumberStr}
                readOnly
                style={{ width: '100%', maxWidth: '240px', height: '22px', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-readonly)', color: 'var(--text)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '4px' }}>
              <label style={{ width: '120px', textAlign: 'right', paddingRight: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>Status</label>
              <input
                type="text"
                value={status}
                readOnly
                style={{ width: '100%', maxWidth: '240px', height: '22px', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-readonly)', color: 'var(--text)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '4px' }}>
              <label style={{ width: '120px', textAlign: 'right', paddingRight: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>Posting Date</label>
              <input
                type="date"
                value={postingDate}
                onChange={e => setPostingDate(e.target.value)}
                style={{ width: '100%', maxWidth: '240px', height: '22px', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '4px' }}>
              <label style={{ width: '120px', textAlign: 'right', paddingRight: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>
                Delivery Date <span style={{ color: '#c62828', fontWeight: 'bold' }}>*</span>
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                style={{ width: '100%', maxWidth: '240px', height: '22px', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '4px' }}>
              <label style={{ width: '120px', textAlign: 'right', paddingRight: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>Document Date</label>
              <input
                type="date"
                value={docDate}
                onChange={e => setDocDate(e.target.value)}
                style={{ width: '100%', maxWidth: '240px', height: '22px', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text)', fontSize: '12px' }}
              />
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '8px 12px 0 12px', backgroundColor: 'var(--bg-panel)' }}>
          {['contents', 'advance', 'remarks'].map(tabKey => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey)}
              style={{
                padding: '4px 16px',
                backgroundColor: activeTab === tabKey ? 'var(--tab-active-bg)' : 'var(--tab-inactive-bg)',
                fontWeight: activeTab === tabKey ? 700 : 400,
                border: '1px solid var(--border)',
                borderBottom: activeTab === tabKey ? '1px solid var(--tab-active-bg)' : 'none',
                marginBottom: activeTab === tabKey ? '-1px' : '0',
                marginRight: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                color: 'var(--text)',
                borderTopLeftRadius: '2px',
                borderTopRightRadius: '2px'
              }}
            >
              {tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Panels */}
        <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-panel)', minHeight: '220px' }}>
          
          {/* TAB 1: CONTENTS (Grid) */}
          {activeTab === 'contents' && (
            <div style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', maxHeight: '320px', overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '12px', minWidth: '820px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '32px', textAlign: 'center', backgroundColor: 'var(--bg-header)', border: '1px solid var(--border)', padding: '4px 6px' }}>#</th>
                    <th style={{ width: '105px', backgroundColor: 'var(--bg-header)', border: '1px solid var(--border)', padding: '4px 6px' }}>Item No.</th>
                    <th style={{ width: '250px', backgroundColor: 'var(--bg-header)', border: '1px solid var(--border)', padding: '4px 6px' }}>Item Description</th>
                    <th style={{ width: '75px', textAlign: 'right', backgroundColor: 'var(--bg-header)', border: '1px solid var(--border)', padding: '4px 6px' }}>Quantity</th>
                    <th style={{ width: '95px', textAlign: 'right', backgroundColor: 'var(--bg-header)', border: '1px solid var(--border)', padding: '4px 6px' }}>Unit Price</th>
                    <th style={{ width: '80px', textAlign: 'right', backgroundColor: 'var(--bg-header)', border: '1px solid var(--border)', padding: '4px 6px' }}>Discount %</th>
                    <th style={{ width: '70px', textAlign: 'right', backgroundColor: 'var(--bg-header)', border: '1px solid var(--border)', padding: '4px 6px' }}>GST %</th>
                    <th style={{ width: '105px', textAlign: 'right', backgroundColor: 'var(--bg-header)', border: '1px solid var(--border)', padding: '4px 6px' }}>Total (LC)</th>
                    <th style={{ width: '30px', textAlign: 'center', backgroundColor: 'var(--bg-header)', border: '1px solid var(--border)', padding: '4px 6px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.id} style={{ backgroundColor: idx % 2 === 1 ? 'var(--grid-row-alt)' : 'transparent' }}>
                      <td style={{ border: '1px solid var(--border)', textAlign: 'center', backgroundColor: 'var(--bg-readonly)', color: 'var(--text-muted)' }}>
                        {idx + 1}
                      </td>
                      <td style={{ border: '1px solid var(--border)', padding: 0 }}>
                        <input
                          type="text"
                          value={row.itemCode}
                          list="reactCatalogList"
                          onChange={e => handleItemCodeChange(idx, e.target.value)}
                          placeholder="Item code..."
                          style={{ width: '100%', height: '23px', border: 'none', background: 'transparent', padding: '2px 5px', fontSize: '12px', color: 'var(--text)', outline: 'none' }}
                        />
                      </td>
                      <td style={{ border: '1px solid var(--border)', padding: 0 }}>
                        <input
                          type="text"
                          value={row.desc}
                          readOnly
                          style={{ width: '100%', height: '23px', border: 'none', backgroundColor: 'var(--bg-readonly)', padding: '2px 5px', fontSize: '12px', color: 'var(--text)', outline: 'none' }}
                        />
                      </td>
                      <td style={{ border: '1px solid var(--border)', padding: 0 }}>
                        <input
                          type="number"
                          value={row.qty}
                          min="0"
                          step="1"
                          onChange={e => handleFieldChange(idx, 'qty', e.target.value)}
                          style={{ width: '100%', height: '23px', border: 'none', background: 'transparent', padding: '2px 5px', fontSize: '12px', textAlign: 'right', color: 'var(--text)', outline: 'none' }}
                        />
                      </td>
                      <td style={{ border: '1px solid var(--border)', padding: 0 }}>
                        <input
                          type="number"
                          value={row.price}
                          step="0.01"
                          min="0"
                          onChange={e => handleFieldChange(idx, 'price', e.target.value)}
                          style={{ width: '100%', height: '23px', border: 'none', background: 'transparent', padding: '2px 5px', fontSize: '12px', textAlign: 'right', color: 'var(--text)', outline: 'none' }}
                        />
                      </td>
                      <td style={{ border: '1px solid var(--border)', padding: 0 }}>
                        <input
                          type="number"
                          value={row.disc}
                          min="0"
                          max="100"
                          step="0.01"
                          onChange={e => handleFieldChange(idx, 'disc', e.target.value)}
                          style={{ width: '100%', height: '23px', border: 'none', background: 'transparent', padding: '2px 5px', fontSize: '12px', textAlign: 'right', color: 'var(--text)', outline: 'none' }}
                        />
                      </td>
                      <td style={{ border: '1px solid var(--border)', padding: 0 }}>
                        <input
                          type="number"
                          value={row.gst}
                          min="0"
                          step="0.01"
                          onChange={e => handleFieldChange(idx, 'gst', e.target.value)}
                          style={{ width: '100%', height: '23px', border: 'none', background: 'transparent', padding: '2px 5px', fontSize: '12px', textAlign: 'right', color: 'var(--text)', outline: 'none' }}
                        />
                      </td>
                      <td style={{ border: '1px solid var(--border)', padding: 0 }}>
                        <input
                          type="text"
                          value={formatINR(row.totalLC)}
                          readOnly
                          style={{ width: '100%', height: '23px', border: 'none', backgroundColor: 'var(--bg-readonly)', padding: '2px 5px', fontSize: '12px', textAlign: 'right', color: 'var(--text)', outline: 'none' }}
                        />
                      </td>
                      <td style={{ border: '1px solid var(--border)', textAlign: 'center', padding: 0 }}>
                        <button
                          type="button"
                          disabled={rows.length <= 1}
                          onClick={() => handleDeleteRow(idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: rows.length <= 1 ? '#cbd5e1' : '#94a3b8',
                            cursor: rows.length <= 1 ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            width: '100%',
                            height: '100%'
                          }}
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <datalist id="reactCatalogList">
                {catalog.map(it => (
                  <option key={it.code} value={it.code} label={`${it.desc} (₹${it.price.toFixed(2)})`} />
                ))}
              </datalist>
            </div>
          )}

          {/* TAB 2: ADVANCE */}
          {activeTab === 'advance' && (
            <div style={{ maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '140px', color: 'var(--text-muted)', fontSize: '12px' }}>Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value)}
                  style={{ width: '200px', height: '22px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text)', fontSize: '12px' }}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '140px', color: 'var(--text-muted)', fontSize: '12px' }}>Advance Received</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={advanceReceived}
                  onChange={e => setAdvanceReceived(e.target.value)}
                  placeholder="0.00"
                  style={{ width: '200px', height: '22px', textAlign: 'right', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text)', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ width: '140px', color: 'var(--text-muted)', fontSize: '12px' }}>Balance Due</label>
                <input
                  type="text"
                  value={formatINR(totals.balanceDue)}
                  readOnly
                  style={{ width: '200px', height: '22px', textAlign: 'right', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-readonly)', color: 'var(--text)', fontSize: '12px' }}
                />
              </div>
            </div>
          )}

          {/* TAB 3: REMARKS */}
          {activeTab === 'remarks' && (
            <div style={{ maxWidth: '500px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '12px' }}>Order Notes & Remarks:</label>
              <textarea
                rows={6}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Enter special packing, delivery or customer instructions..."
                style={{ width: '100%', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text)', fontSize: '12px', padding: '6px', outline: 'none' }}
              />
            </div>
          )}

        </div>

        {/* Bottom Section */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '20px',
            padding: '10px 14px 12px 14px',
            borderTop: '1px solid var(--border)',
            flexWrap: 'wrap'
          }}
        >
          {/* Bottom Left */}
          <div style={{ width: '100%', maxWidth: '380px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ width: '125px', color: 'var(--text-muted)', fontSize: '12px' }}>Sales Employee</label>
              <select
                value={salesEmployee}
                onChange={e => setSalesEmployee(e.target.value)}
                style={{ width: '200px', height: '22px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text)', fontSize: '12px' }}
              >
                <option value="none">-No Sales Employee-</option>
                <option value="Admin">Admin Staff</option>
                <option value="Counter1">Counter Operator</option>
                <option value="SalesTeam">Sales Team</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ width: '125px', color: 'var(--text-muted)', fontSize: '12px' }}>Owner</label>
              <input
                type="text"
                value={owner}
                readOnly
                style={{ width: '200px', height: '22px', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-readonly)', color: 'var(--text)', fontSize: '12px' }}
              />
            </div>
          </div>

          {/* Bottom Right: Totals */}
          <div style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <label style={{ color: 'var(--text-muted)', width: '160px' }}>Total Before Discount</label>
              <input
                type="text"
                readOnly
                value={formatINR(totals.beforeDisc)}
                style={{ width: '150px', height: '22px', textAlign: 'right', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-readonly)', color: 'var(--text)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <label style={{ color: 'var(--text-muted)', width: '160px' }}>Discount</label>
              <input
                type="text"
                readOnly
                value={formatINR(totals.discount)}
                style={{ width: '150px', height: '22px', textAlign: 'right', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-readonly)', color: 'var(--text)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <label style={{ color: 'var(--text-muted)', width: '160px' }}>Rounding</label>
              <input
                type="text"
                readOnly
                value={formatINR(totals.rounding)}
                style={{ width: '150px', height: '22px', textAlign: 'right', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-readonly)', color: 'var(--text)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <label style={{ color: 'var(--text-muted)', width: '160px' }}>Tax (CGST + SGST)</label>
              <input
                type="text"
                readOnly
                value={formatINR(totals.tax)}
                style={{ width: '150px', height: '22px', textAlign: 'right', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-readonly)', color: 'var(--text)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', fontWeight: 700 }}>
              <label style={{ width: '160px' }}>Total Payment Due</label>
              <input
                type="text"
                readOnly
                value={formatINR(totals.paymentDue)}
                style={{ width: '150px', height: '22px', textAlign: 'right', padding: '1px 6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-readonly)', color: 'var(--text)', fontSize: '12.5px', fontWeight: 700 }}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions & Message Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderTop: '1px solid var(--border)',
            backgroundColor: 'var(--bg-panel)',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            onClick={handleAddOrder}
            style={{
              backgroundColor: '#f0b429',
              color: '#1d2630',
              border: '1px solid #d49b1a',
              padding: '3px 22px',
              height: '25px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Add
          </button>

          <button
            type="button"
            onClick={handleCancelOrder}
            style={{
              backgroundColor: 'var(--btn-sec)',
              color: 'var(--btn-sec-text)',
              border: '1px solid var(--btn-sec-border)',
              padding: '3px 18px',
              height: '25px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          {message.text && (
            <div
              style={{
                marginLeft: '12px',
                padding: '3px 12px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: message.type === 'error' ? '#c62828' : '#2e7d32',
                color: '#ffffff'
              }}
            >
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
