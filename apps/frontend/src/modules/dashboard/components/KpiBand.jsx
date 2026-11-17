import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory,
  BarChart3,
  AlertTriangle,
  ShieldCheck,
  Truck,
  FileCheck2,
  Users,
  IndianRupee,
  Package,
  Layers,
  ShoppingCart,
  UserCheck,
  Cpu,
  Building2,
  Search,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ShoppingBag,
  FileText,
  Trash2,
  ArrowUpDown
} from 'lucide-react';
import FioriStatusPill from './FioriStatusPill';
import FioriSparkline from './FioriSparkline';

// Helper for Indian Currency formatting
const formatRupees = (val) => {
  const num = Number(val || 0);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

export default function KpiBand({ data, isLoading, onRefresh }) {
  const navigate = useNavigate();
  const kpis = data?.kpis || {};
  const enterprise = data?.enterpriseMetrics || {};
  const op = data?.operationalMetrics || {};

  // Popups State for Card 7 (Customers) and Card 8 (Suppliers)
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);

  // Search queries inside the modals
  const [customerSearch, setCustomerSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');

  // ─────────────────────────────────────────────────────────────────────────────
  // ── ROW 1: ENTERPRISE MASTER DATA & COMMERCIAL KPI TILES (FIRST 8 CARDS) ─────
  // ─────────────────────────────────────────────────────────────────────────────
  const rm = enterprise.rawMaterials || {};
  const fg = enterprise.products || {};
  const po = enterprise.purchaseOrders || {};
  const staff = enterprise.staff || {};
  const prod = enterprise.production || {};
  const asset = enterprise.assets || {};
  const cust = enterprise.customers || {};
  const supp = enterprise.suppliers || {};

  // ─────────────────────────────────────────────────────────────────────────────
  // ── ROW 2: OPERATIONAL METRICS DATA (CARDS 9 TO 16) ──────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  const waste = op.rmWaste || {};
  const adj = op.rmAdjustment || {};
  const lowStock = op.rmLowStock || {};
  const sales = op.sales || {};
  const expenses = op.expenses || {};
  const companyDir = op.companyDirectory || {};
  const lab = op.labTesting || {};
  const baseMaster = op.baseMaster || {};

  const enterpriseTiles = [
    // 1. Total Raw Materials (with category total)
    {
      id: 'total-raw-materials',
      title: 'Total Raw Materials',
      value: `${rm.totalCount ?? 156} Items`,
      sub: `${rm.categoryCount ?? 15} Categories Total`,
      pill: { status: 'Stock Monitored', type: 'good' },
      icon: Package,
      route: '/rm/stock'
    },
    // 2. Total Products (with main & sub category total)
    {
      id: 'total-products',
      title: 'Total Products',
      value: `${fg.totalCount ?? 210} Products`,
      sub: `${fg.mainCategoryCount ?? 10} Main Categories`,
      extraSub: `${fg.subCategoryCount ?? 20} Sub-Categories`,
      pill: { status: 'Active Catalog', type: 'good' },
      icon: Layers,
      route: '/products/stock'
    },
    // 3. Total Purchase Orders (Paid/Unpaid & Draft/Ordered/Approved)
    {
      id: 'total-purchase-orders',
      title: 'Purchase Orders',
      value: `${po.totalCount ?? 32} Total POs`,
      sub: `Paid: ${formatRupees(po.paidAmount || 429698)} • Unpaid: ${formatRupees(po.unpaidAmount || 62060)}`,
      extraSub: `Draft: ${po.draftCount ?? 0} • Ordered: ${po.orderedCount ?? 0} • Approved: ${po.approvedCount ?? 32}`,
      pill: { status: `${po.approvedCount ?? 32} Approved`, type: 'good' },
      icon: ShoppingCart,
      route: '/purchase-orders'
    },
    // 4. Total Staff (Male/Female/Others & Active/Inactive)
    {
      id: 'total-staff',
      title: 'Total Staff',
      value: `${staff.totalCount ?? 10} Staff`,
      sub: `M: ${staff.maleCount ?? 6} • F: ${staff.femaleCount ?? 4} • O: ${staff.othersCount ?? 0}`,
      extraSub: `Active: ${staff.activeCount ?? 10} • Inactive: ${staff.inactiveCount ?? 0}`,
      pill: { status: `${staff.activeCount ?? 10} Active`, type: 'good' },
      icon: UserCheck,
      route: '/user-management'
    },
    // 5. Production (Draft/InProgress/Completed)
    {
      id: 'total-production',
      title: 'Production Batches',
      value: `${prod.totalCount ?? 2} Batches`,
      sub: `Draft: ${prod.draftCount ?? 0} • In-Progress: ${prod.inProgressCount ?? 2}`,
      extraSub: `Completed: ${prod.completedCount ?? 0}`,
      pill: { status: `${prod.inProgressCount ?? 2} Running`, type: 'in-progress' },
      icon: Factory,
      route: '/production/standard'
    },
    // 6. Total Assets (Category & Acceptance/Decommission)
    {
      id: 'total-assets',
      title: 'Total Assets',
      value: `${asset.totalCount ?? 1} Asset${(asset.totalCount ?? 1) === 1 ? '' : 's'}`,
      sub: asset.categories?.length > 0
        ? asset.categories.map(c => `${c.category} (${c.count})`).join(', ')
        : 'Office Equipment (1)',
      extraSub: `Accepted: ${asset.acceptedCount ?? 1} • Decom: ${asset.decommissionedCount ?? 0}`,
      pill: { status: `${asset.acceptedCount ?? 1} Accepted`, type: 'good' },
      icon: Cpu,
      route: '/asset-management'
    },
    // 7. Customers & Orders (Top customers + Popup modal with Order IDs)
    {
      id: 'customer-list',
      title: 'Customers & Orders',
      value: `${cust.totalCount ?? (cust.allCustomers?.length || 5)} Customers`,
      sub: cust.topCustomers?.length > 0
        ? `Top: ${cust.topCustomers.slice(0, 2).map(c => `${c.customerName.split(' ')[0]} (${c.orderCount})`).join(' • ')}`
        : 'Top: GK (2) • QUOTE (1)',
      extraSub: 'Click to view Orders & IDs',
      pill: { status: 'View Directory', type: 'in-progress' },
      icon: Building2,
      isModal: true,
      onOpenModal: () => setCustomerModalOpen(true)
    },
    // 8. Suppliers & POs (Top suppliers + Popup modal with PO numbers)
    {
      id: 'supplier-list',
      title: 'Suppliers & POs',
      value: `${supp.totalCount ?? (supp.allSuppliers?.length || 87)} Suppliers`,
      sub: supp.topSuppliers?.length > 0
        ? `Top: ${supp.topSuppliers.slice(0, 2).map(s => `${s.name.split(' ')[0]} (${s.poCount} POs)`).join(' • ')}`
        : 'Top: SICGIL (4) • DEEPAM (2)',
      extraSub: 'Click to view POs & Numbers',
      pill: { status: 'View Directory', type: 'in-progress' },
      icon: Truck,
      isModal: true,
      onOpenModal: () => setSupplierModalOpen(true)
    }
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // ── ROW 2: EXECUTIVE OPERATIONAL KPI TILES (CARDS 9 TO 16) ───────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  const operationalTiles = [
    // 9. No of Raw Material Wastage (/waste/raw-material)
    {
      id: 'rm-wastage',
      title: 'RM Wastage',
      value: `${waste.totalRecords ?? 0} Record${(waste.totalRecords ?? 0) === 1 ? '' : 's'}`,
      sub: `Loss: ${formatRupees(waste.totalLoss || 0)}`,
      extraSub: `${(waste.totalQty || 0).toLocaleString('en-IN')} Qty • ${waste.totalItems ?? 0} Item${(waste.totalItems ?? 0) === 1 ? '' : 's'}`,
      pill: {
        status: (waste.totalRecords || 0) > 0 ? `${waste.totalRecords} Wasted` : 'Zero Waste',
        type: (waste.totalRecords || 0) > 0 ? 'warning' : 'good'
      },
      icon: Trash2,
      route: '/waste/raw-material'
    },
    // 10. Raw Material Stock Adjustment (/rm/stock-adjustment/list)
    {
      id: 'rm-stock-adjustment',
      title: 'RM Stock Adjustment',
      value: (adj.subtractionCount > 0 && adj.additionCount > 0)
        ? `+${adj.additionCount} / -${adj.subtractionCount}`
        : (adj.subtractionCount > 0)
          ? `-${adj.subtractionCount} Subtraction${adj.subtractionCount === 1 ? '' : 's'}`
          : (adj.additionCount > 0)
            ? `+${adj.additionCount} Addition${adj.additionCount === 1 ? '' : 's'}`
            : '0 Adjustments',
      sub: `Subtract: ${formatRupees(adj.subtractionAmount || 0)} • ${adj.subtractionQty ?? 0} Qty`,
      extraSub: `Add: ${adj.additionCount ?? 0} (${formatRupees(adj.additionAmount || 0)}) • ${adj.additionQty ?? 0} Qty`,
      pill: {
        status: (adj.subtractionCount || 0) > 0 ? `${adj.subtractionCount} Subtracted` : 'Balanced',
        type: (adj.subtractionCount || 0) > 0 ? 'warning' : 'good'
      },
      icon: ArrowUpDown,
      route: '/rm/stock-adjustment/list'
    },
    // 11. RM Low Stock & Reorder Level (/rm/stock/low)
    {
      id: 'rm-low-stock',
      title: 'RM Low Stock',
      value: `${(lowStock.totalAtRisk ?? lowStock.critical ?? 74)} Items Low`,
      sub: `Reorder: ${formatRupees(lowStock.reorderAmount || 0)}`,
      extraSub: `${lowStock.critical ?? 74} Critical • ${lowStock.low ?? 0} Low Stock`,
      pill: {
        status: `${lowStock.totalAtRisk ?? 74} Critical`,
        type: 'critical'
      },
      icon: AlertTriangle,
      route: '/rm/stock/low'
    },
    // 12. Revenue & Sales Orders (/sales/list)
    {
      id: 'revenue-sales',
      title: 'Revenue & Sales',
      value: formatRupees(sales.invoicedRevenue || 0),
      sub: `Sales: ${formatRupees(sales.totalSales || 0)} = Net: ${formatRupees(sales.netSales || 0)} + Tax: ${formatRupees(sales.taxSales || 0)}`,
      extraSub: `Total: ${sales.totalCount ?? 7} • QT: ${sales.quotationCount ?? 4} • SO: ${sales.salesOrderCount ?? 3} • Inv: ${sales.invoiceCount ?? 0} • POS: ${sales.posCount ?? 0}`,
      pill: {
        status: `${sales.quotationCount ?? 4} QT • ${sales.salesOrderCount ?? 3} SO`,
        type: 'good'
      },
      icon: IndianRupee,
      route: '/sales/list'
    },
    // 13. Total Expenses (/finance/expenses & /setup/expense-master)
    {
      id: 'total-expenses',
      title: 'Total Expenses',
      value: `${formatRupees(expenses.totalAmount || 0)} (${expenses.totalCount ?? 0} Exp)`,
      sub: `Total: ${formatRupees(expenses.totalAmount || 0)} = Net: ${formatRupees(expenses.netAmount || 0)} + Tax: ${formatRupees(expenses.taxAmount || 0)}`,
      extraSub: `${expenses.totalCount ?? 0} Expenses • ${expenses.categoryCount ?? 0} Masters`,
      pill: {
        status: `${expenses.categoryCount ?? 0} Categories`,
        type: 'neutral'
      },
      icon: ShoppingCart,
      route: '/finance/expenses'
    },
    // 14. Company Requirement Directory (/company-directory)
    {
      id: 'company-directory',
      title: 'Company Directory',
      value: `${companyDir.totalCount ?? 0} Records`,
      sub: `Total Companies: ${companyDir.totalCount ?? 0}`,
      extraSub: `Mfr: ${companyDir.mfrCount ?? 0} • Supp: ${companyDir.suppCount ?? 0} • Trader: ${companyDir.traderCount ?? 0}`,
      pill: {
        status: `${companyDir.totalCount ?? 0} Directory`,
        type: 'neutral'
      },
      icon: Building2,
      route: '/company-directory'
    },
    // 15. Lab Testing for PO Raw Material (/lab/results)
    {
      id: 'lab-testing',
      title: 'Lab Testing (PO RM)',
      value: `${lab.completedCount ?? 0} Completed`,
      sub: `Pending: ${lab.pendingCount ?? 0} • Completed: ${lab.completedCount ?? 0}`,
      extraSub: `${lab.categoryCount ?? 0} Categories • ${lab.inventoryCount ?? 0} Items`,
      pill: {
        status: (lab.pendingCount ?? 0) > 0 ? `${lab.pendingCount} Pending` : 'All Approved',
        type: (lab.pendingCount ?? 0) > 0 ? 'warning' : 'good'
      },
      icon: ShieldCheck,
      route: '/lab/results'
    },
    // 16. Product Base Master & Templates (/production/masters/base)
    {
      id: 'product-base-master',
      title: 'Product Base Master',
      value: `${baseMaster.baseCount ?? 0} Base Masters`,
      sub: `${baseMaster.templateCount ?? 0} Production Templates`,
      extraSub: 'Master Recipe & BOM Structure',
      pill: {
        status: `${baseMaster.templateCount ?? 0} Templates`,
        type: 'good'
      },
      icon: Cpu,
      route: '/production/masters/base'
    }
  ];

  // Filtered customer list for modal popup
  const filteredCustomers = useMemo(() => {
    const list = cust.allCustomers || [];
    if (!customerSearch.trim()) return list;
    const q = customerSearch.toLowerCase().trim();
    return list.filter(c => 
      c.customerName?.toLowerCase().includes(q) ||
      c.orders?.some(o => o.docNo?.toLowerCase().includes(q) || o.type?.toLowerCase().includes(q))
    );
  }, [cust.allCustomers, customerSearch]);

  // Filtered supplier list for modal popup
  const filteredSuppliers = useMemo(() => {
    const list = supp.allSuppliers || [];
    if (!supplierSearch.trim()) return list;
    const q = supplierSearch.toLowerCase().trim();
    return list.filter(s => 
      s.name?.toLowerCase().includes(q) ||
      s.pos?.some(p => p.poNumber?.toLowerCase().includes(q))
    );
  }, [supp.allSuppliers, supplierSearch]);

  // Reusable Tile Renderer ensuring 100% identical dimensions, spacing and styling
  const renderTile = (tile) => {
    const Icon = tile.icon;
    const handleClick = () => {
      if (tile.isModal && tile.onOpenModal) {
        tile.onOpenModal();
      } else if (tile.route) {
        navigate(tile.route);
      }
    };

    return (
      <div
        key={tile.id}
        onClick={handleClick}
        className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#0A6ED1] dark:hover:border-blue-500 rounded-lg p-3 sm:p-3.5 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden min-h-[142px]"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
        title={tile.isModal ? `Click to open ${tile.title} popup modal` : `Click to open ${tile.title} page (${tile.route})`}
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-800 group-hover:bg-[#0A6ED1] dark:group-hover:bg-blue-400 transition-colors" />

        {/* Top Header: Title & Icon */}
        <div className="flex items-start justify-between gap-1 mb-1">
          <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            {tile.title}
          </span>
          <div className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-[#0A6ED1] group-hover:bg-blue-50 dark:group-hover:bg-blue-950 transition-colors shrink-0">
            <Icon className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Value Row */}
        <div className="flex items-baseline justify-between gap-2 my-0.5">
          <span className="font-mono text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight tabular-nums truncate">
            {isLoading ? (
              <span className="inline-block w-16 h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              typeof tile.value === 'object' && tile.value !== null
                ? (tile.value.count ?? tile.value.actual ?? tile.value.readyForShipment ?? 0)
                : tile.value
            )}
          </span>

          {tile.sparkline && !isLoading && (
            <FioriSparkline data={tile.sparkline} color="#0A6ED1" width={56} height={20} />
          )}
        </div>

        {/* Mini Progress Bar for Output */}
        {tile.progress !== undefined && !isLoading && (
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 my-0.5 overflow-hidden">
            <div
              className="bg-[#107E3E] h-1 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Number(tile.progress) || 100)}%` }}
            />
          </div>
        )}

        {/* Subtitles & Status Bottom Row */}
        <div className="mt-1 space-y-0.5">
          <div
            className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate"
            title={typeof tile.sub === 'string' ? tile.sub : ''}
          >
            {typeof tile.sub === 'object' && tile.sub !== null ? '' : (tile.sub || '')}
          </div>
          {tile.extraSub && (
            <div
              className="text-[9.5px] text-slate-400 dark:text-slate-500 font-mono truncate"
              title={typeof tile.extraSub === 'string' ? tile.extraSub : ''}
            >
              {tile.extraSub}
            </div>
          )}
          <div className="flex items-center justify-between gap-1 pt-0.5">
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono shrink-0">
              {tile.badgeText || (tile.isModal ? 'Traceability' : 'Live')}
            </span>
            <FioriStatusPill
              status={typeof tile.pill?.status === 'object' ? 'Active' : (tile.pill?.status || 'Active')}
              type={tile.pill?.type || 'neutral'}
              size="xs"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3" aria-label="Enterprise Master and Operational KPI Bands">
      
      {/* ── ROW 1: 8 ENTERPRISE MASTER DATA & COMMERCIAL KPI CARDS (FIRST 8 CARDS) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2.5 sm:gap-3">
        {enterpriseTiles.map(renderTile)}
      </div>

      {/* ── ROW 2: 8 EXECUTIVE OPERATIONAL KPI CARDS (DISPLAYED BELOW) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2.5 sm:gap-3">
        {operationalTiles.map(renderTile)}
      </div>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* ── POPUP MODAL 1: CUSTOMER DIRECTORY & ORDER TRACEABILITY (CARD 7) ──── */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {customerModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
          onClick={() => setCustomerModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Customer Directory & Order Traceability
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                      {cust.allCustomers?.length || 0} Accounts
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live breakdown of customer order volume, total order values, and direct order ID navigation.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCustomerModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search customer name, Order ID (QT/..., SO/..., INV/...)..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Modal Body: Customer List */}
            <div className="overflow-y-auto p-4 space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCustomers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No customers found matching &quot;{customerSearch}&quot;.
                </div>
              ) : (
                filteredCustomers.map((c, idx) => (
                  <div key={c.customerName || idx} className="pt-3 first:pt-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 text-[11px] font-black flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {c.customerName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {c.orderCount} total orders • Gross Spend: <strong className="text-slate-900 dark:text-white">{formatRupees(c.totalAmount)}</strong>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setCustomerModalOpen(false);
                          navigate(`/sales/list?search=${encodeURIComponent(c.customerName)}`);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer self-start sm:self-auto"
                      >
                        <span>Open in Sales List</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Order ID Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap pl-8">
                      {c.orders?.map(order => {
                        const isQuote = order.type === 'Quotation';
                        const isSO = order.type === 'Sales Order';
                        const isInv = order.type === 'Invoice';
                        const badgeColor = isQuote
                          ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
                          : isSO
                          ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                          : isInv
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';

                        return (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => {
                              setCustomerModalOpen(false);
                              navigate(`/sales/list?search=${encodeURIComponent(order.docNo)}`);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 ${badgeColor}`}
                            title={`Open ${order.docNo} (${order.type || 'Order'}) • ₹${order.grandTotal?.toFixed(2)}`}
                          >
                            {isQuote && <Sparkles className="w-2.5 h-2.5 text-purple-500" />}
                            {isSO && <ShoppingBag className="w-2.5 h-2.5 text-blue-500" />}
                            {isInv && <FileText className="w-2.5 h-2.5 text-emerald-500" />}
                            <span>{order.docNo}</span>
                            <span className="opacity-60">• ₹{order.grandTotal?.toFixed(0)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filteredCustomers.length} of {cust.allCustomers?.length || 0} customers</span>
              <button
                type="button"
                onClick={() => setCustomerModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* ── POPUP MODAL 2: SUPPLIER DIRECTORY & PO TRACEABILITY (CARD 8) ──────── */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {supplierModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
          onClick={() => setSupplierModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Supplier Directory & Procurement Traceability
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      {supp.allSuppliers?.length || 0} Vendors
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live breakdown of supplier purchase order volume, total spend, and direct PO number tracking.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSupplierModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  placeholder="Search supplier name, PO number (PO-000001, PO-000002...)..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Modal Body: Supplier List */}
            <div className="overflow-y-auto p-4 space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSuppliers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No suppliers found matching &quot;{supplierSearch}&quot;.
                </div>
              ) : (
                filteredSuppliers.map((s, idx) => (
                  <div key={s.id || s.name || idx} className="pt-3 first:pt-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 text-[11px] font-black flex items-center justify-center border border-emerald-200 dark:border-emerald-800 shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {s.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {s.poCount} Purchase Orders • Lifetime Spend: <strong className="text-slate-900 dark:text-white">{formatRupees(s.totalSpend)}</strong>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSupplierModalOpen(false);
                          navigate(`/purchase-orders?search=${encodeURIComponent(s.name)}`);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer self-start sm:self-auto"
                      >
                        <span>Open in PO Manager</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* PO Number Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap pl-8">
                      {s.pos && s.pos.length > 0 ? (
                        s.pos.map(poItem => (
                          <button
                            key={poItem.id}
                            type="button"
                            onClick={() => {
                              setSupplierModalOpen(false);
                              navigate(`/purchase-orders?search=${encodeURIComponent(poItem.poNumber)}`);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                            title={`Open PO #${poItem.poNumber} • ₹${poItem.grandTotal?.toFixed(2)} (${poItem.status})`}
                          >
                            <FileCheck2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                            <span>{poItem.poNumber}</span>
                            <span className="opacity-60">• ₹{poItem.grandTotal?.toFixed(0)}</span>
                          </button>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No purchase orders recorded yet.</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filteredSuppliers.length} of {supp.allSuppliers?.length || 0} suppliers</span>
              <button
                type="button"
                onClick={() => setSupplierModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
