import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { BarChart3, TrendingUp, AlertTriangle, ShieldAlert, Award, Calendar, Plus, RefreshCw, ShoppingBag, Layers, Users, Users2, BadgePercent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePicker from '@/components/ui/DatePicker';
import Swal from 'sweetalert2';
import { Pagination } from '@/components/ui/Pagination';

export default function SalesDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Campaign form states
  const [campaignName, setCampaignName] = useState('');
  const [campaignProductId, setCampaignProductId] = useState('');
  const [campaignTargetQty, setCampaignTargetQty] = useState(1000);
  const [campaignPrice, setCampaignPrice] = useState(12);
  const [campaignMinDeposit, setCampaignMinDeposit] = useState(15);
  const [campaignStart, setCampaignStart] = useState(new Date().toISOString().split('T')[0]);
  const [campaignEnd, setCampaignEnd] = useState(new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0]);
  const [campaignsList, setCampaignsList] = useState([]);
  const [productsList, setProductsList] = useState([]);

  // Campaign booking form state
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [bookingCustName, setBookingCustName] = useState('');
  const [bookingQty, setBookingQty] = useState(100);
  const [bookingDeposit, setBookingDeposit] = useState(200);

  // Pagination states
  const [productPage, setProductPage] = useState(1);
  const [distributorPage, setDistributorPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const fetchDashboardReports = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales/reports/dashboard');
      setData(res.data);

      const campRes = await api.get('/sales/campaigns');
      setCampaignsList(campRes.data || []);

      const prodRes = await api.get('/products');
      setProductsList(prodRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardReports();
  }, []);

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    const isDark = document.documentElement.classList.contains('dark');
    try {
      const payload = {
        name: campaignName,
        productId: campaignProductId,
        targetQuantity: Number(campaignTargetQty),
        price: Number(campaignPrice),
        minDepositPercent: Number(campaignMinDeposit),
        startDate: campaignStart,
        endDate: campaignEnd
      };

      await api.post('/sales/campaigns', payload);
      
      Swal.fire({
        title: '<span class="text-sm font-bold">Campaign Launched!</span>',
        text: 'The festival pre-sale campaign has been created and is active.',
        icon: 'success',
        confirmButtonColor: '#4f46e5',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });

      setCampaignName('');
      setCampaignProductId('');
      fetchDashboardReports();
    } catch (e) {
      Swal.fire({
        title: '<span class="text-sm font-bold">Launch Failed</span>',
        text: e.response?.data?.error || 'Failed to create campaign.',
        icon: 'error',
      });
    }
  };

  const handleBookOrder = async (e) => {
    e.preventDefault();
    const isDark = document.documentElement.classList.contains('dark');
    try {
      const payload = {
        customerName: bookingCustName,
        quantity: Number(bookingQty),
        depositPaid: Number(bookingDeposit)
      };

      await api.post(`/sales/campaigns/${selectedCampaignId}/book`, payload);

      Swal.fire({
        title: '<span class="text-sm font-bold">Pre-order Booked!</span>',
        text: 'Pre-order has been logged with deposit receipt. Stock is allocated on QC pass.',
        icon: 'success',
        confirmButtonColor: '#4f46e5',
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
      });

      setBookingCustName('');
      setBookingQty(100);
      setBookingDeposit(200);
      fetchDashboardReports();
    } catch (e) {
      Swal.fire({
        title: '<span class="text-sm font-bold">Booking Failed</span>',
        text: e.response?.data?.error || 'Failed to book pre-order.',
        icon: 'error',
      });
    }
  };

  if (loading || !data) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold">Loading Manager Sales Report Dashboard...</span>
      </div>
    );
  }

  // Sliced data for paginated tables
  const productSalesList = data.productSales || [];
  const totalProductPages = Math.ceil(productSalesList.length / ITEMS_PER_PAGE);
  const paginatedProductSales = productSalesList.slice((productPage - 1) * ITEMS_PER_PAGE, productPage * ITEMS_PER_PAGE);

  const distributorsList = data.distributors || [];
  const totalDistributorPages = Math.ceil(distributorsList.length / ITEMS_PER_PAGE);
  const paginatedDistributors = distributorsList.slice((distributorPage - 1) * ITEMS_PER_PAGE, distributorPage * ITEMS_PER_PAGE);

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-205 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <BarChart3 className="w-5.5 h-5.5 mr-2 text-indigo-650 shrink-0" />
            Manager Sales & Festivals Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5 font-medium">
            View daily sales margins, track distributor ledgers, and manage seasonal campaigns.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboardReports} className="rounded-xl border-slate-202 bg-white dark:bg-slate-900 h-9 text-xs font-bold w-full sm:w-auto">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh Dashboard
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Sales Revenue</span>
          <span className="text-lg font-black font-mono text-indigo-650 mt-1">₹{data.dailySales.revenue.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 font-medium">{data.dailySales.count} Transactions</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-855 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Cost Price</span>
          <span className="text-lg font-black font-mono text-slate-750 dark:text-white mt-1">₹{data.dailySales.cost.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 font-medium">FIFO ingredients cost</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-855 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Net Profit</span>
          <span className="text-lg font-black font-mono text-emerald-650 mt-1">₹{data.dailySales.profit.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-450 mt-0.5 font-medium">Margin: {data.dailySales.revenue > 0 ? ((data.dailySales.profit/data.dailySales.revenue)*100).toFixed(1) : 0}%</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-855 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Logged Returns</span>
          <span className="text-lg font-black font-mono text-rose-500 mt-1">{data.totalReturns} Returns</span>
          <span className="text-[10px] text-slate-400 mt-0.5 font-medium">Resale vs Wastage tracked</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
        {/* Left Section: Product-wise & Distributor Ledgers */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Product Sales table */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-205 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center text-xs uppercase tracking-wide">
              <ShoppingBag className="w-4 h-4 mr-1.5 text-indigo-500" /> Product-wise Sales Report
            </h3>
            <div className="border border-slate-105 dark:border-slate-850 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b dark:border-slate-800">
                  <tr>
                    <th className="p-3">Product Name</th>
                    <th className="p-3 text-right">Units Sold</th>
                    <th className="p-3 text-right font-bold text-slate-800 dark:text-white">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedProductSales.length > 0 ? (
                    paginatedProductSales.map((ps, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-950/20 transition-colors">
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{ps.name}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-600 dark:text-slate-400">{ps.qty_sold} pcs</td>
                        <td className="p-3 text-right font-mono font-bold text-indigo-650 dark:text-indigo-400">₹{Number(ps.revenue).toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-400 italic">No product sales logged yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Product sales table pagination */}
            {totalProductPages > 1 && (
              <div className="pt-2 flex justify-center">
                <Pagination 
                  currentPage={productPage} 
                  totalPages={totalProductPages} 
                  onPageChange={setProductPage} 
                />
              </div>
            )}
          </div>

          {/* Distributor Outstandings ledger check */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-205 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center text-xs uppercase tracking-wide">
              <Users className="w-4 h-4 mr-1.5 text-indigo-500" /> Distributor Outstanding & Credit Ledger
            </h3>
            <div className="border border-slate-105 dark:border-slate-850 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-505 font-bold border-b dark:border-slate-800">
                  <tr>
                    <th className="p-3">Distributor</th>
                    <th className="p-3 text-right">Terms</th>
                    <th className="p-3 text-right">Credit Limit</th>
                    <th className="p-3 text-right font-bold">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedDistributors.length > 0 ? (
                    paginatedDistributors.map((dist, idx) => {
                      const limitExceeded = dist.outstanding > dist.creditLimit;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-950/20 transition-colors">
                          <td className="p-3 font-semibold text-slate-805 dark:text-slate-200">{dist.name}</td>
                          <td className="p-3 text-right text-slate-500 font-semibold">{dist.paymentTermsDays} days</td>
                          <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">₹{dist.creditLimit.toLocaleString()}</td>
                          <td className={`p-3 text-right font-mono font-bold ${
                            limitExceeded ? 'text-rose-500' : 'text-slate-800 dark:text-white'
                          }`}>
                            ₹{dist.outstanding.toLocaleString()} {limitExceeded && <span className="text-[10px] text-rose-500 font-bold">(Blocked)</span>}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400 italic">No active distributors.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Distributor Ledger Table Pagination */}
            {totalDistributorPages > 1 && (
              <div className="pt-2 flex justify-center">
                <Pagination 
                  currentPage={distributorPage} 
                  totalPages={totalDistributorPages} 
                  onPageChange={setDistributorPage} 
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Columns: Festival Campaigns & Pre-orders */}
        <div className="space-y-4">
          {/* Campaign Creation form */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-205 dark:border-slate-800 shadow-xs space-y-3">
            <div>
              <h3 className="font-bold text-slate-805 dark:text-white flex items-center text-xs uppercase tracking-wider">
                <BadgePercent className="w-4.5 h-4.5 mr-1.5 text-indigo-500 animate-bounce" /> Launch Seasonal Pre-sale Campaign
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Collect pre-orders with deposit for upcoming productions.</p>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-500 block">Campaign Name</label>
                <Input placeholder="e.g. Diwali Fest Pre-sale 2026" required value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-500 block">Product</label>
                <select
                  required
                  value={campaignProductId}
                  onChange={(e) => setCampaignProductId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9"
                >
                  <option value="">Select product...</option>
                  {productsList.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500 block">Target Qty</label>
                  <Input type="number" min="1" value={campaignTargetQty} onChange={(e) => setCampaignTargetQty(e.target.value)} className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500 block">Promo Price (₹)</label>
                  <Input type="number" min="1" step="0.01" value={campaignPrice} onChange={(e) => setCampaignPrice(e.target.value)} className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500 block">Deposit %</label>
                  <Input type="number" min="0" max="100" value={campaignMinDeposit} onChange={(e) => setCampaignMinDeposit(e.target.value)} className="h-9 text-xs" />
                </div>
              </div>

              <Button type="submit" className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-bold h-9 rounded-xl text-xs cursor-pointer">
                Launch Pre-sale Campaign
              </Button>
            </form>
          </div>

          {/* Book Preorder form */}
          {campaignsList.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-205 dark:border-slate-800 shadow-xs space-y-3 animate__animated animate__fadeIn">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center text-xs uppercase tracking-wider">
                  <Users2 className="w-4.5 h-4.5 mr-1.5 text-indigo-500" /> Book Campaign Pre-order
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Log distributor deposit pre-orders for campaigns.</p>
              </div>

              <form onSubmit={handleBookOrder} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500 block">Select Campaign</label>
                  <select
                    required
                    value={selectedCampaignId}
                    onChange={(e) => {
                      setSelectedCampaignId(e.target.value);
                      const cmp = campaignsList.find(c => c.id === e.target.value);
                      if (cmp) {
                        setBookingQty(100);
                        setBookingDeposit(Number(cmp.price) * 100 * (Number(cmp.minDepositPercent)/100));
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-9"
                  >
                    <option value="">Select active campaign...</option>
                    {campaignsList.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (₹{c.price}/pc)</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500 block">Customer Name / Store</label>
                  <Input placeholder="e.g. Metro Sweet Emporium" required value={bookingCustName} onChange={(e) => setBookingCustName(e.target.value)} className="h-9 text-xs" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-500 block">Quantity (pcs)</label>
                    <Input type="number" min="1" value={bookingQty} onChange={(e) => setBookingQty(e.target.value)} className="h-9 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-500 block">Deposit Paid (₹)</label>
                    <Input type="number" min="0" value={bookingDeposit} onChange={(e) => setBookingDeposit(e.target.value)} className="h-9 text-xs font-mono" />
                  </div>
                </div>

                <Button type="submit" disabled={!selectedCampaignId} className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-bold h-9 rounded-xl text-xs cursor-pointer">
                  Record Campaign Pre-order
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
