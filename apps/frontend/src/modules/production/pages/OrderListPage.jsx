import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import {
  ShoppingCart, Search, RefreshCw, Plus, Edit, Trash2, Eye,
  Download, Printer, X, ChevronLeft, ChevronRight, Package,
  TrendingUp, Calendar, IndianRupee, Filter, ArrowUpDown
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import AddOrderPage from './AddOrderPage';

const STATUS_CONFIG = {
  'Quotation':            { bg: 'bg-blue-50 dark:bg-blue-500/10',   text: 'text-blue-600 dark:text-blue-400',   dot: 'bg-blue-500 dark:bg-blue-400',   border: 'border-blue-100 dark:border-blue-500/20' },
  'Confirmed':            { bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500 dark:bg-violet-400', border: 'border-violet-100 dark:border-violet-500/20' },
  'Waiting for Production':{ bg: 'bg-slate-100 dark:bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400',  dot: 'bg-slate-500 dark:bg-slate-400',  border: 'border-slate-200 dark:border-slate-500/20' },
  'In Production':        { bg: 'bg-amber-50 dark:bg-amber-500/10',  text: 'text-amber-700 dark:text-amber-400',  dot: 'bg-amber-500 dark:bg-amber-400',  border: 'border-amber-100 dark:border-amber-500/20' },
  'Ready for Shipment':   { bg: 'bg-teal-50 dark:bg-teal-500/10',   text: 'text-teal-600 dark:text-teal-400',   dot: 'bg-teal-500 dark:bg-teal-400',   border: 'border-teal-100 dark:border-teal-500/20' },
  'Delivered':            { bg: 'bg-emerald-50 dark:bg-emerald-500/10',text: 'text-emerald-600 dark:text-emerald-400',dot: 'bg-emerald-500 dark:bg-emerald-400',border: 'border-emerald-100 dark:border-emerald-500/20' },
  'Cancelled':            { bg: 'bg-rose-50 dark:bg-rose-500/10',   text: 'text-rose-600 dark:text-rose-400',   dot: 'bg-rose-500 dark:bg-rose-400',   border: 'border-rose-100 dark:border-rose-500/20' },
};

const PAGE_SIZE = 12;

export default function OrderListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState({ type: 'list', prefill: null });

  useEffect(() => {
    if (location.pathname === '/orders/add' || location.pathname.startsWith('/orders/edit/') || location.state) {
      setView({ type: 'create', prefill: location.state });
    } else {
      setView({ type: 'list', prefill: null });
    }
  }, [location]);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Load Company & Tax Settings dynamically from localStorage
  const savedSettings = localStorage.getItem('kulfi_erp_tax_settings');
  let compName = 'Kulfi ERP System Ltd.';
  let compAddr = '12, Ice Cream Industrial Zone, Mumbai, Maharashtra';
  let compGstin = '27AABC1234F1Z5';

  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      if (parsed.companyName) compName = parsed.companyName;
      if (parsed.companyAddress) compAddr = parsed.companyAddress;
      if (parsed.companyGstin) compGstin = parsed.companyGstin;
    } catch (e) {
      console.error('Error parsing tax settings in OrderListPage', e);
    }
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

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await api.patch(`/orders/${id}/status`, { status: newStatus });
      fetchOrders();
    } catch (e) { alert(e.response?.data?.error || 'Failed to update status'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this order? Stock will be reclaimed.')) return;
    try {
      await api.delete(`/orders/${id}`);
      fetchOrders();
    } catch (e) { alert(e.response?.data?.error || 'Failed to delete order'); }
  };

  const handleExport = () => {
    if (!orders.length) return;
    const headers = ['Order Ref','Customer','Type','Delivery Date','Status','Total (INR)','Profit (INR)','Created'];
    const rows = orders.map(o => [
      o.referenceNo, o.customer?.name || 'N/A', o.type,
      new Date(o.deliveryDate).toLocaleDateString('en-GB'), o.status,
      Number(o.totalSubtotal).toFixed(2), Number(o.totalProfit).toFixed(2),
      new Date(o.createdAt).toLocaleDateString('en-GB')
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handlePrint = (order) => {
    const items = order.items || [];
    const itemRows = items.map((item, idx) => {
      const unitPrice = Number(item.unitPrice || 0);
      const discount = Number(item.discount || 0);
      const qty = Number(item.quantity || 0);
      const cgstRate = Number(item.product?.cgst || 9);
      const sgstRate = Number(item.product?.sgst || 9);
      const igstRate = Number(item.product?.igst || 9);
      const sub = (unitPrice - discount) * qty;
      const cgstAmt = sub * cgstRate / 100;
      const sgstAmt = sub * sgstRate / 100;
      const igstAmt = sub * igstRate / 100;
      const total = sub + cgstAmt + sgstAmt + igstAmt;
      return `
        <tr>
          <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #f1f5f9;">${idx + 1}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
            <strong style="color:#1e293b;">${item.product?.name || 'Item'}</strong>
            <span style="color:#94a3b8;font-size:11px;display:block;">${item.product?.code || ''}</span>
          </td>
          <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #f1f5f9;">${qty}</td>
          <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #f1f5f9;">₹${unitPrice.toFixed(2)}</td>
          <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #f1f5f9;">₹${discount.toFixed(2)}</td>
          <td style="padding:10px 12px;text-align:right;color:#64748b;border-bottom:1px solid #f1f5f9;">₹${cgstAmt.toFixed(2)} (${cgstRate}%)</td>
          <td style="padding:10px 12px;text-align:right;color:#64748b;border-bottom:1px solid #f1f5f9;">₹${sgstAmt.toFixed(2)} (${sgstRate}%)</td>
          <td style="padding:10px 12px;text-align:right;color:#64748b;border-bottom:1px solid #f1f5f9;">₹${igstAmt.toFixed(2)} (${igstRate}%)</td>
          <td style="padding:10px 12px;text-align:right;font-weight:700;color:#1e293b;border-bottom:1px solid #f1f5f9;">₹${total.toFixed(2)}</td>
        </tr>`;
    }).join('');

    const grandTotal = items.reduce((acc, item) => {
      const sub = (Number(item.unitPrice) - Number(item.discount)) * Number(item.quantity);
      const tax = sub * ((Number(item.product?.cgst || 9) + Number(item.product?.sgst || 9) + Number(item.product?.igst || 9)) / 100);
      return acc + sub + tax;
    }, 0);

    const subtotal = Number(order.totalSubtotal || 0);
    const printDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const deliveryDate = new Date(order.deliveryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const createdDate = new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice – ${order.referenceNo}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;padding:32px;}
    @page{size:A4;margin:16mm;}
    @media print{body{padding:0;}}

    /* Header */
    .inv-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:3px solid #4f46e5;margin-bottom:24px;}
    .company-name{font-size:22px;font-weight:900;color:#4f46e5;letter-spacing:-0.5px;text-transform:uppercase;}
    .company-sub{font-size:11px;color:#64748b;margin-top:4px;line-height:1.6;}
    .inv-label{text-align:right;}
    .inv-title{font-size:24px;font-weight:800;color:#0f172a;letter-spacing:1px;text-transform:uppercase;}
    .inv-ref{font-family:monospace;font-size:13px;font-weight:700;color:#4f46e5;margin-top:4px;}
    .inv-date{font-size:11px;color:#64748b;margin-top:2px;}

    /* Info Grid */
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;}
    .info-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;}
    .info-card-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px;}
    .info-card-name{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;}
    .info-card-sub{font-size:11px;color:#64748b;line-height:1.7;}
    .badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:10px;font-weight:700;background:#dcfce7;color:#15803d;letter-spacing:0.5px;}

    /* Table */
    table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px;}
    thead tr{background:#4f46e5;color:#fff;}
    thead th{padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;}
    thead th:first-child{text-align:center;}
    thead th:not(:first-child){text-align:right;}
    thead th:nth-child(2){text-align:left;}
    tbody tr:nth-child(even){background:#f8fafc;}

    /* Totals */
    .totals-wrap{display:flex;justify-content:flex-end;margin-bottom:32px;}
    .totals-box{width:300px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;}
    .totals-row{display:flex;justify-content:space-between;padding:8px 16px;font-size:12px;border-bottom:1px solid #e2e8f0;}
    .totals-row:last-child{background:#4f46e5;color:#fff;font-weight:800;font-size:13px;border-bottom:none;}
    .totals-label{color:#64748b;}
    .totals-row:last-child .totals-label{color:#c7d2fe;}

    /* Footer */
    .inv-footer{border-top:2px solid #e2e8f0;padding-top:16px;display:flex;justify-content:space-between;align-items:flex-end;font-size:10px;color:#94a3b8;}
    .sig-line{border-top:1px solid #cbd5e1;width:160px;padding-top:6px;text-align:center;font-size:10px;color:#64748b;}
    .watermark{font-size:9px;text-align:center;color:#cbd5e1;margin-top:16px;}
  </style>
</head>
<body>
  <!-- Header with dynamic details fetched from Tax Settings page -->
  <div class="inv-header">
    <div>
      <div class="company-name">${compName}</div>
      <div class="company-sub">
        ${compAddr}<br>
        GSTIN: ${compGstin} &nbsp;|&nbsp; Tel: +91-22-12345678 &nbsp;|&nbsp; info@kulferp.com
      </div>
    </div>
    <div class="inv-label">
      <div class="inv-title">Tax Invoice</div>
      <div class="inv-ref">${order.referenceNo}</div>
      <div class="inv-date">Date: ${createdDate}</div>
      <div class="inv-date">Printed: ${printDate}</div>
    </div>
  </div>

  <!-- Billed To / Order Info -->
  <div class="info-grid">
    <div class="info-card">
      <div class="info-card-label">Billed To</div>
      <div class="info-card-name">${order.customer?.name || 'N/A'}</div>
      <div class="info-card-sub">
        Phone: ${order.customer?.phone || 'N/A'}<br>
        Address: ${order.deliveryAddress || order.customer?.address || 'N/A'}<br>
        ${order.customer?.gstin ? 'GSTIN: ' + order.customer.gstin : ''}
      </div>
    </div>
    <div class="info-card">
      <div class="info-card-label">Order Details</div>
      <div class="info-card-sub">
        <strong>Order Type:</strong> ${order.type}<br>
        <strong>Status:</strong> &nbsp;<span class="badge">${order.status}</span><br>
        <strong>Delivery Date:</strong> ${deliveryDate}<br>
        <strong>Created On:</strong> ${createdDate}
      </div>
    </div>
  </div>

  <!-- Items Table -->
  <table>
    <thead>
      <tr>
        <th>#</th><th style="text-align:left;">Item</th>
        <th>Qty</th><th>Rate</th><th>Discount</th>
        <th>CGST</th><th>SGST</th><th>IGST</th><th>Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows || '<tr><td colspan="9" style="text-align:center;padding:16px;color:#94a3b8;">No items</td></tr>'}</tbody>
  </table>

  <!-- Totals -->
  <div class="totals-wrap">
    <div class="totals-box">
      <div class="totals-row">
        <span class="totals-label">Subtotal (excl. tax)</span>
        <span>₹${subtotal.toFixed(2)}</span>
      </div>
      <div class="totals-row">
        <span class="totals-label">Grand Total (incl. GST)</span>
        <span>₹${grandTotal.toFixed(2)}</span>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="inv-footer">
    <div>
      <div style="margin-bottom:8px;font-size:11px;color:#475569;font-weight:600;">Terms & Conditions</div>
      <div>1. Payment due within 30 days of invoice date.</div>
      <div>2. Goods once sold will not be taken back.</div>
      <div>3. Subject to Mumbai jurisdiction only.</div>
    </div>
    <div style="text-align:right;">
      <div class="sig-line">Authorised Signatory</div>
    </div>
  </div>
  <div class="watermark">This is a computer-generated invoice and does not require a physical signature.</div>

  <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const statuses = ['All', ...Object.keys(STATUS_CONFIG)];
  const filtered = orders.filter(o => {
    const matchSearch = o.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter]);

  const totalRevenue = orders.reduce((s, o) => s + Number(o.totalSubtotal || 0), 0);
  const totalProfit = orders.reduce((s, o) => s + Number(o.totalProfit || 0), 0);
  const pending = orders.filter(o => !['Delivered','Cancelled'].includes(o.status)).length;

  if (view.type === 'create') {
    return <AddOrderPage />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-55 via-white to-slate-100/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-6 text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-500/30 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Customer Orders</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm ml-13 pl-1">Manage, track and invoice customer orders</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate('/orders/add')}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5">
            <Plus className="w-4 h-4" /> New Order
          </button>
          <button onClick={handleExport} disabled={!orders.length}
            className="flex items-center gap-2 px-3 py-2.5 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl transition-all disabled:opacity-40">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={fetchOrders} disabled={loading}
            className="p-2.5 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-505 dark:text-slate-404 rounded-xl transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 print:hidden">
        {[
          { label: 'Total Orders', value: orders.length, icon: Package, color: 'indigo' },
          { label: 'Active Orders', value: pending, icon: TrendingUp, color: 'amber' },
          { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: IndianRupee, color: 'emerald' },
          { label: 'Total Profit', value: `₹${totalProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: totalProfit >= 0 ? 'teal' : 'rose' },
        ].map((s, i) => (
          <div key={i} className="bg-white/80 dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">{s.label}</p>
            <p className={`text-xl font-bold text-${s.color}-600 dark:text-${s.color}-400`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 print:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-505" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by reference or customer..."
            className="w-full bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-505 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 dark:text-slate-505" />
          {statuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                statusFilter === s
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-505 hover:text-slate-800 dark:hover:text-slate-200'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800/60 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-transparent">
                <th className="px-4 py-3 text-center">#</th>
                <th className="px-4 py-3 text-left">Ref No</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Products</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Profit</th>
                <th className="px-4 py-3 text-center">Delivery</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Update</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/30">
              {loading ? (
                <tr><td colSpan={10} className="py-20 text-center text-slate-500 dark:text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                  Loading orders...
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={10} className="py-20 text-center text-slate-500 dark:text-slate-400">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  No orders found
                </td></tr>
              ) : paginated.map((order, idx) => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['Quotation'];
                const profit = Number(order.totalProfit);
                return (
                  <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors group">
                    <td className="px-4 py-3.5 text-center text-slate-404 dark:text-slate-504 text-xs font-mono">
                      {(currentPage - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-100 dark:border-indigo-500/20">
                        {order.referenceNo}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-slate-200">{order.customer?.name || 'N/A'}</td>
                    <td className="px-4 py-3.5 max-w-[200px]">
                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate block" title={order.items?.map(it => `${it.product?.name} x${it.quantity}`).join(', ')}>
                        {order.items?.map(it => `${it.product?.name || 'Item'}`).join(', ') || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-800 dark:text-slate-200">
                      ₹{Number(order.totalSubtotal).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                    <td className={`px-4 py-3.5 text-right font-bold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      ₹{profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs">
                        <Calendar className="w-3 h-3" />
                        {new Date(order.deliveryDate).toLocaleDateString('en-GB')}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <select value={order.status} onChange={e => handleUpdateStatus(order.id, e.target.value)}
                        className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer">
                        {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setSelectedOrder(order); setShowInvoice(true); }}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="View Invoice">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => navigate(`/orders/edit/${order.id}`)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors" title="Edit">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(order.id)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50/30 dark:bg-transparent">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Showing {Math.min((currentPage-1)*PAGE_SIZE+1, filtered.length)}–{Math.min(currentPage*PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(p-1,1))} disabled={currentPage===1}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({length: totalPages}, (_,i) => i+1).filter(p => Math.abs(p-currentPage)<=2).map(p => (
                <button key={p} onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 text-xs font-medium rounded-lg transition-colors ${p===currentPage ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(p+1,totalPages))} disabled={currentPage===totalPages}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      {showInvoice && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden relative print:shadow-none print:rounded-none max-h-[90vh] flex flex-col print:bg-white print:text-slate-900">
            <div className="flex justify-between items-center px-8 py-4 border-b border-slate-200 dark:border-slate-800 print:hidden">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Tax Invoice</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => handlePrint(selectedOrder)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
                  <Printer className="w-4 h-4" /> Print Invoice
                </button>
                <button onClick={() => setShowInvoice(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-505 dark:text-slate-404">
                  <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-8 space-y-6">
              {/* Dynamic Invoice Header (using state configured on Tax & Company Settings page) */}
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
                <div>
                  <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">{compName}</h2>
                  <p className="text-xs text-slate-550 dark:text-slate-400 mt-1">{compAddr}</p>
                  <p className="text-xs text-slate-550 dark:text-slate-400 font-semibold mt-0.5">GSTIN: {compGstin}</p>
                </div>
                <div className="text-right">
                  <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">TAX INVOICE</h3>
                  <p className="text-sm font-mono font-semibold text-indigo-600 dark:text-indigo-400">{selectedOrder.referenceNo}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{new Date(selectedOrder.createdAt).toLocaleDateString('en-GB')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl text-sm print:bg-slate-50">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase block mb-1">Billed To</span>
                  <p className="font-bold">{selectedOrder.customer?.name}</p>
                  <p className="text-slate-500 dark:text-slate-400">Phone: {selectedOrder.customer?.phone || 'N/A'}</p>
                  <p className="text-slate-500 dark:text-slate-400">Address: {selectedOrder.deliveryAddress || selectedOrder.customer?.address || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase block mb-1">Order Info</span>
                  <p>Type: <strong>{selectedOrder.type}</strong></p>
                  <p>Status: <strong className="text-emerald-600">{selectedOrder.status}</strong></p>
                  <p>Delivery: <strong>{new Date(selectedOrder.deliveryDate).toLocaleDateString('en-GB')}</strong></p>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs uppercase border-b border-slate-200 dark:border-slate-700 print:bg-slate-100 print:text-slate-600">
                    {['#','Item','Qty','Rate','Discount','CGST','SGST','IGST','Amount'].map(h => (
                      <th key={h} className="px-3 py-2 text-right first:text-center">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-xs">
                  {(selectedOrder.items || []).map((item, idx) => {
                    const sub = (Number(item.unitPrice) - Number(item.discount)) * Number(item.quantity);
                    const cgst = Number(item.product?.cgst || 9);
                    const sgst = Number(item.product?.sgst || 9);
                    const igst = Number(item.product?.igst || 9);
                    const total = sub * (1 + (cgst+sgst+igst)/100);
                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-2.5 text-center">{idx+1}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-200">{item.product?.name} <span className="text-slate-400 dark:text-slate-500 font-normal font-sans">({item.product?.code})</span></td>
                        <td className="px-3 py-2.5 text-right">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-right">₹{Number(item.unitPrice).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right">₹{Number(item.discount).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500 dark:text-slate-400">₹{(sub*cgst/100).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500 dark:text-slate-400">₹{(sub*sgst/100).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500 dark:text-slate-400">₹{(sub*igst/100).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-bold">₹{total.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="w-72 space-y-2 text-sm">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-mono">₹{Number(selectedOrder.totalSubtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-indigo-600 dark:text-indigo-400 border-t border-slate-200 dark:border-slate-800 pt-2">
                    <span>Grand Total (incl. GST):</span>
                    <span className="font-mono">₹{(Number(selectedOrder.totalSubtotal)*1.18).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
