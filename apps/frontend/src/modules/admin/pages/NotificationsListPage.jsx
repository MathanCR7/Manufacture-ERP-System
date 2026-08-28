import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Check, 
  CheckSquare, 
  Square, 
  Search, 
  Filter, 
  ArrowRight, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  CheckCircle2, 
  FileText, 
  Truck, 
  FlaskConical, 
  Activity, 
  AlertTriangle,
  ChevronDown,
  Package
} from 'lucide-react';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/app/store/authStore';
import { Pagination } from '@/components/ui/Pagination';
import { isVisibleToRole } from '@/config/notifications.config';

const PhaseColors = {
  PO_CREATED: 'bg-indigo-55 text-indigo-700 dark:bg-indigo-955/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/30',
  PO_UPDATED: 'bg-sky-50 text-sky-700 dark:bg-sky-955/40 dark:text-sky-300 border-sky-200 dark:border-sky-800/30',
  PO_AMENDED: 'bg-sky-50 text-sky-700 dark:bg-sky-955/40 dark:text-sky-300 border-sky-200 dark:border-sky-800/30',
  PO_CANCELLED: 'bg-rose-50 text-rose-700 dark:bg-rose-955/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/30',
  PO_STATUS_CHANGED: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-955/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/30',
  
  GRN_SUBMITTED: 'bg-cyan-55 text-cyan-700 dark:bg-cyan-955/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/30',
  
  LAB_RM_APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-955/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/30',
  LAB_RM_REJECTED: 'bg-rose-50 text-rose-700 dark:bg-rose-955/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/30',
  LAB_RM_RESAMPLE: 'bg-amber-50 text-amber-700 dark:bg-amber-955/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/30',
  
  FINAL_QTY_SUBMITTED: 'bg-blue-50 text-blue-700 dark:bg-blue-955/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/30',
  
  PRODUCTION_STARTED: 'bg-purple-50 text-purple-700 dark:bg-purple-955/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/30',
  PRODUCTION_ON_HOLD: 'bg-amber-50 text-amber-700 dark:bg-amber-955/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/30',
  PRODUCTION_COMPLETED: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-955/40 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800/30',
  PRODUCTION_QC_PASSED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-955/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/30',
  PRODUCTION_QC_FAILED: 'bg-rose-50 text-rose-700 dark:bg-rose-955/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/30',
  
  STOCK_LOW_ALERT: 'bg-amber-50 text-amber-700 dark:bg-amber-955/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/30',
  STOCK_REPRODUCTION: 'bg-amber-50 text-amber-700 dark:bg-amber-955/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/30',
  RM_LOW_STOCK_ALERT: 'bg-amber-50 text-amber-700 dark:bg-amber-955/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/30',
  STOCK_EXPIRY_ALERT: 'bg-rose-50 text-rose-700 dark:bg-rose-955/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/30',
  STOCK_CRITICAL: 'bg-rose-55 text-rose-700 dark:bg-rose-955/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/30',
  STOCK_REORDER: 'bg-amber-50 text-amber-700 dark:bg-amber-955/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/30',
  UPCOMING_DELIVERY: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/30',

  ASSET_PR_CREATED: 'bg-blue-50 text-blue-700 dark:bg-blue-955/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/30',
  ASSET_PR_APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-955/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/30',
  ASSET_PQ_CREATED: 'bg-purple-50 text-purple-700 dark:bg-purple-955/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/30',
  ASSET_PO_CREATED: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-955/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/30',
  ASSET_GRPO_CREATED: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-955/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/30',
  ASSET_INVOICE_CREATED: 'bg-sky-50 text-sky-700 dark:bg-sky-955/40 dark:text-sky-300 border-sky-200 dark:border-sky-800/30',
};

const getCategoryIcon = (type) => {
  if (type === 'UPCOMING_DELIVERY') return <Truck className="w-4 h-4 text-indigo-650 dark:text-indigo-400" />;
  if (type.startsWith('PO_')) return <FileText className="w-4 h-4 text-indigo-650 dark:text-indigo-400" />;
  if (type.startsWith('GRN_')) return <Truck className="w-4 h-4 text-cyan-650 dark:text-cyan-400" />;
  if (type.startsWith('LAB_')) return <FlaskConical className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
  if (type.startsWith('PRODUCTION_')) return <Activity className="w-4 h-4 text-purple-650 dark:text-purple-400" />;
  if (type.startsWith('ASSET_') || type.includes('ASSET_')) return <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  if (type.includes('STOCK_') || type.includes('LOW_STOCK') || type.includes('REORDER') || type.includes('REPRODUCTION')) return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
  return <Bell className="w-4 h-4 text-slate-500" />;
};

const relativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const categories = [
  { value: 'ALL', label: 'All Categories', icon: <Bell className="w-3.5 h-3.5" /> },
  { value: 'PO', label: 'Purchase Orders', icon: <FileText className="w-3.5 h-3.5 text-indigo-500" /> },
  { value: 'GRN', label: 'GRN Receipts', icon: <Truck className="w-3.5 h-3.5 text-cyan-550" /> },
  { value: 'LAB', label: 'Lab Quality', icon: <FlaskConical className="w-3.5 h-3.5 text-emerald-500" /> },
  { value: 'PRODUCTION', label: 'Production Batches', icon: <Activity className="w-3.5 h-3.5 text-purple-550" /> },
  { value: 'ASSET', label: 'Asset Management', icon: <Package className="w-3.5 h-3.5 text-blue-500" /> },
  { value: 'ALERTS', label: 'Inventory Alerts', icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> },
];

const NotificationsListPage = () => {
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, UNREAD, READ
  const [typeFilter, setTypeFilter] = useState('ALL'); // ALL, PO, GRN, LAB, PRODUCTION, ASSET, ALERTS
  const [searchTerm, setSearchTerm] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  
  const limit = 15;

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/notifications', {
        params: {
          paginated: true,
          page,
          limit
        }
      });
      
      setNotifications(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotalItems(data.meta?.total || 0);
    } catch (err) {
      console.error("Error fetching notifications", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [page]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (isCategoryOpen && !document.getElementById('category-dropdown-container')?.contains(e.target)) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isCategoryOpen]);

  const handleMarkAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/seen`);
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, seenAt: new Date().toISOString() } : n
      ));
    } catch (err) {
      console.error("Failed to mark as seen", err);
    }
  };

  const handleMarkSelectedAsRead = async () => {
    if (selectedIds.length === 0) return;
    try {
      setLoading(true);
      await Promise.all(selectedIds.map(id => api.patch(`/notifications/${id}/seen`)));
      setNotifications(prev => prev.map(n => 
        selectedIds.includes(n.id) ? { ...n, seenAt: new Date().toISOString() } : n
      ));
      setSelectedIds([]);
    } catch (err) {
      console.error("Failed to mark selected as read", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setLoading(true);
      await api.patch('/notifications/seen-all');
      setNotifications(prev => prev.map(n => ({
        ...n,
        seenAt: n.seenAt || new Date().toISOString()
      })));
      setSelectedIds([]);
    } catch (err) {
      console.error("Failed to mark all as seen", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (filteredNotifs) => {
    const unreadFiltered = filteredNotifs.filter(n => !n.seenAt);
    const unreadFilteredIds = unreadFiltered.map(n => n.id);
    const allSelected = unreadFilteredIds.every(id => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !unreadFilteredIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const unique = new Set([...prev, ...unreadFilteredIds]);
        return Array.from(unique);
      });
    }
  };

  const handleNavigateToContext = (notif) => {
    if (!notif.seenAt) {
      handleMarkAsRead(notif.id);
    }

    const { type, metadata, referenceId } = notif;
    const poId = metadata?.purchaseOrderId || metadata?.poId || metadata?.po_id || referenceId;
    const grnId = metadata?.grn_id || metadata?.grnId || referenceId;

    if (type === 'UPCOMING_DELIVERY') {
      navigate('/grn/upcoming', { state: { from: '/notifications' } });
      return;
    }

    if (type.startsWith('PO_')) {
      if (poId && poId !== 'system') {
        navigate(`/purchase-orders/${poId}`, { state: { from: '/notifications' } });
      } else {
        navigate('/purchase-orders', { state: { from: '/notifications' } });
      }
    } else if (type.startsWith('GRN_')) {
      if (user?.role === 'LAB_ASSISTANT' && !metadata?.is_tested) {
        navigate(`/lab/test/${grnId}`, { state: { from: '/notifications' } });
      } else if (grnId && grnId !== 'system') {
        navigate(`/grn/view/${grnId}`, { state: { from: '/notifications' } });
      } else {
        navigate('/grn/list', { state: { from: '/notifications' } });
      }
    } else if (type.startsWith('LAB_')) {
      navigate('/lab/results', { state: { from: '/notifications' } });
    } else if (type.startsWith('PRODUCTION_') || type === 'STOCK_REPRODUCTION' || type.includes('REPRODUCTION')) {
      if (type === 'PRODUCTION_QC_PASSED' || type === 'PRODUCTION_QC_FAILED' || type === 'PRODUCTION_COMPLETED') {
        navigate('/production/qc-queue', { state: { from: '/notifications' } });
      } else {
        navigate('/production/batches', { state: { from: '/notifications' } });
      }
    } else if (type.startsWith('ASSET_PR_') || type.startsWith('ASSET_PR') || type.includes('ASSET_PR')) {
      navigate('/asset-management/requests', { state: { from: '/notifications' } });
    } else if (type.startsWith('ASSET_PQ_') || type.includes('ASSET_PQ')) {
      navigate('/asset-management/quotations', { state: { from: '/notifications' } });
    } else if (type.startsWith('ASSET_PO_') || type.includes('ASSET_PO')) {
      navigate('/asset-management/orders', { state: { from: '/notifications' } });
    } else if (type.startsWith('ASSET_GRPO_')) {
      navigate('/asset-management/grpo', { state: { from: '/notifications' } });
    } else if (type.startsWith('ASSET_INVOICE_')) {
      navigate('/asset-management/invoice', { state: { from: '/notifications' } });
    } else if (type.startsWith('ASSET_')) {
      navigate('/asset-management/requests', { state: { from: '/notifications' } });
    } else if (type.includes('STOCK_') || type.includes('REORDER') || type.includes('LOW_STOCK')) {
      if (type.startsWith('RM_')) {
        navigate('/purchase/rm-low-stock', { state: { from: '/notifications' } });
      } else {
        navigate('/production/low-stock-alerts', { state: { from: '/notifications' } });
      }
    } else {
      navigate('/notifications');
    }
  };

  // Filter local state
  const filteredNotifications = notifications.filter(notif => {
    // Role filter
    if (!isVisibleToRole(notif.type, user?.role)) return false;

    // Search filter
    const matchesSearch = searchTerm ? (
      notif.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notif.type?.toLowerCase().includes(searchTerm.toLowerCase())
    ) : true;

    // Status filter
    let matchesStatus = true;
    if (statusFilter === 'UNREAD') {
      matchesStatus = !notif.seenAt;
    } else if (statusFilter === 'READ') {
      matchesStatus = !!notif.seenAt;
    }

    // Category / Type filter
    let matchesType = true;
    if (typeFilter !== 'ALL') {
      if (typeFilter === 'ALERTS') {
        matchesType = notif.type.includes('STOCK_') || notif.type.includes('LOW_STOCK') || notif.type.includes('REORDER');
      } else {
        matchesType = notif.type.startsWith(typeFilter + '_');
      }
    }

    return matchesSearch && matchesStatus && matchesType;
  });

  const visibleUnreadNotifs = filteredNotifications.filter(n => !n.seenAt);
  const isAllSelected = visibleUnreadNotifs.length > 0 && visibleUnreadNotifs.every(n => selectedIds.includes(n.id));

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300 text-xs">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-205 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <Bell className="w-5.5 h-5.5 mr-2 text-indigo-650 shrink-0" />
            Notification Audit Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Monitor background system notifications, inventory stock levels, and quality checks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {notifications.some(n => !n.seenAt) && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 rounded-xl text-xs font-bold transition focus:outline-none cursor-pointer h-9"
            >
              Mark all as read
            </button>
          )}

          {selectedIds.length > 0 && (
            <button
              onClick={handleMarkSelectedAsRead}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 animate-in slide-in-from-right-3 focus:outline-none cursor-pointer h-9"
            >
              <Check className="w-4 h-4" />
              Mark selected ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Filter and search controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-404" />
            <input
              type="text"
              placeholder="Search notifications by message content or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition duration-150 h-9 font-semibold"
            />
          </div>

          {/* Status filters */}
          <div className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800 shrink-0 h-9 items-center">
            {['ALL', 'UNREAD', 'READ'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer ${
                  statusFilter === status
                    ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-indigo-400 shadow-sm border dark:border-slate-700/50'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Custom Category dropdown */}
          <div className="relative shrink-0" id="category-dropdown-container">
            <button
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              className="w-full md:w-auto flex items-center justify-between gap-3.5 px-4 py-2 bg-slate-950 dark:bg-black hover:bg-slate-900 dark:hover:bg-slate-950 text-white border border-slate-900 dark:border-neutral-900 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition duration-150 focus:outline-none min-w-[200px] h-9 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {(categories.find(c => c.value === typeFilter) || categories[0]).icon}
                <span>{(categories.find(c => c.value === typeFilter) || categories[0]).label}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isCategoryOpen && (
              <div className="absolute right-0 md:left-0 mt-2 w-[220px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => {
                      setTypeFilter(cat.value);
                      setIsCategoryOpen(false);
                      setPage(1);
                    }}
                    className={`w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs font-semibold hover:bg-indigo-50/50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-none bg-transparent ${
                      typeFilter === cat.value
                        ? 'text-indigo-650 dark:text-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/10 font-bold'
                        : 'text-slate-600 dark:text-slate-350 font-medium'
                    }`}
                  >
                    {cat.icon}
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main notifications table card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 rounded-2xl shadow-xs overflow-hidden flex flex-col text-xs">
        {filteredNotifications.length > 0 && (
          <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <button
              onClick={() => toggleSelectAll(filteredNotifications)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition focus:outline-none cursor-pointer"
              title="Select all unread"
            >
              {isAllSelected ? (
                <CheckSquare className="w-5 h-5 text-indigo-650 dark:text-indigo-400" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>
            <span className="text-3xs font-extrabold text-slate-400 uppercase tracking-wider">
              Select all unread in this view
            </span>
          </div>
        )}

        <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
          {loading && notifications.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
              <p className="text-xs font-semibold text-slate-550">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center">
              <Bell className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-205">No notifications match filters</p>
              <p className="text-3xs text-slate-400 mt-1 max-w-md font-medium">
                Try amending your search term, clearing status filters, or selecting "All Categories" from the filter list.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isReturned = notif.type === 'GRN_SUBMITTED' && (notif.metadata?.confirmation_status === 'Returned' || notif.metadata?.confirmation_status === 'RETURNED');
              const isLabMuted = isReturned && user.role === 'LAB_ASSISTANT';
              const isUnread = !notif.seenAt && !isLabMuted;
              
              return (
                <div 
                  key={notif.id}
                  className={`p-4 transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-850 last:border-none relative group ${
                    isUnread 
                      ? 'bg-indigo-50/15 dark:bg-indigo-955/5 border-l-[3.5px] border-l-indigo-650 dark:border-l-indigo-500 pl-3.5' 
                      : 'pl-4'
                  } ${isLabMuted ? 'opacity-55' : ''}`}
                >
                  <div className="flex items-start gap-3.5 flex-1">
                    
                    {/* Checkbox for unread */}
                    {isUnread ? (
                      <button
                        onClick={() => toggleSelect(notif.id)}
                        className="mt-1 shrink-0 text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 transition focus:outline-none cursor-pointer"
                      >
                        {selectedIds.includes(notif.id) ? (
                          <CheckSquare className="w-5 h-5 text-indigo-650 dark:text-indigo-400" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    ) : (
                      <div className="w-5 h-5 shrink-0" />
                    )}

                    {/* Icon container */}
                    <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-200/50 dark:border-slate-700 shrink-0">
                      {getCategoryIcon(notif.type)}
                    </div>

                    {/* Message detail */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-lg border shrink-0 ${PhaseColors[notif.type] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-250 dark:border-slate-700'}`}>
                          {notif.type.replace(/_/g, ' ')}
                        </span>
                        
                        <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold" title={new Date(notif.eventAt).toLocaleString()}>
                          • {relativeTime(notif.eventAt)}
                        </span>
                      </div>
                      
                      <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed max-w-3xl font-medium">
                        {notif.message}
                      </p>
                      
                      {/* Seen receipt log */}
                      {notif.seenAt && notif.userSeenBy && (
                        <div className="flex items-center gap-1 text-[9px] text-slate-450 dark:text-slate-400 pt-0.5 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Seen by {notif.userSeenBy.name} ({notif.userSeenBy.role.replace('_', ' ')}) at {new Date(notif.seenAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions column */}
                  <div className="flex items-center gap-1.5 self-end md:self-auto pl-9 md:pl-0 shrink-0">
                    
                    {/* Mark as read button */}
                    {isUnread && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-650 dark:text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-150 dark:hover:border-indigo-900/40 transition focus:outline-none cursor-pointer"
                      >
                        Mark as read
                      </button>
                    )}

                    {/* Context link (PO, GRN, etc) */}
                    <button
                      onClick={() => handleNavigateToContext(notif)}
                      className="px-3 py-1.5 text-xs font-bold bg-indigo-50 dark:bg-indigo-955/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg border border-indigo-100/45 dark:border-indigo-900/20 transition flex items-center gap-1.5 focus:outline-none cursor-pointer h-8"
                    >
                      View Details
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* Reusable Pagination footer */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-slate-555 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing page {page} of {totalPages} ({totalItems} total alerts)
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={page} 
                totalPages={totalPages} 
                onPageChange={setPage} 
              />
            </div>

            <div className="text-xs text-slate-404 font-medium order-3">
              Total entries: {totalItems} records
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default NotificationsListPage;
