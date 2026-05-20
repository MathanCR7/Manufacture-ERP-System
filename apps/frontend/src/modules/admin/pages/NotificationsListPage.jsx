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
  ChevronDown
} from 'lucide-react';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/app/store/authStore';

const PhaseColors = {
  PO_CREATED: 'bg-indigo-55 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/30',
  PO_UPDATED: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800/30',
  PO_AMENDED: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800/30',
  PO_CANCELLED: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/30',
  PO_STATUS_CHANGED: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/30',
  
  GRN_SUBMITTED: 'bg-cyan-55 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/30',
  
  LAB_RM_APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/30',
  LAB_RM_REJECTED: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/30',
  LAB_RM_RESAMPLE: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/30',
  
  FINAL_QTY_SUBMITTED: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/30',
  
  PRODUCTION_STARTED: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/30',
  PRODUCTION_ON_HOLD: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/30',
  PRODUCTION_COMPLETED: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800/30',
  PRODUCTION_QC_PASSED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/30',
  PRODUCTION_QC_FAILED: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/30',
  
  STOCK_LOW_ALERT: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/30',
  RM_LOW_STOCK_ALERT: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/30',
  STOCK_EXPIRY_ALERT: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/30',
  STOCK_CRITICAL: 'bg-rose-55 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/30',
  STOCK_REORDER: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/30',
};

const getCategoryIcon = (type) => {
  if (type.startsWith('PO_')) return <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
  if (type.startsWith('GRN_')) return <Truck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
  if (type.startsWith('LAB_')) return <FlaskConical className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
  if (type.startsWith('PRODUCTION_')) return <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
  if (type.includes('STOCK_') || type.includes('LOW_STOCK') || type.includes('REORDER')) return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
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
  const [typeFilter, setTypeFilter] = useState('ALL'); // ALL, PO, GRN, LAB, PRODUCTION, ALERTS
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

  // UI Detail Router Mapping
  const handleNavigateToContext = async (notif) => {
    if (!notif.seenAt) {
      try {
        await api.patch(`/notifications/${notif.id}/seen`);
        setNotifications(prev => prev.map(n => 
          n.id === notif.id ? { ...n, seenAt: new Date().toISOString() } : n
        ));
      } catch (err) {
        console.error("Failed to mark as seen on navigate", err);
      }
    }

    const { type, referenceId, metadata } = notif;
    const poId = metadata?.po_id || referenceId;
    const grnId = metadata?.grn_id || referenceId;
    const batchId = metadata?.batch_id || referenceId;
    const navigateOpts = { state: { from: '/notifications' } };
    
    if (type.startsWith('PO_')) {
      navigate(`/purchase-orders/${poId}`, navigateOpts);
    } else if (type.startsWith('GRN_')) {
      navigate(`/grn/view/${grnId}`, navigateOpts);
    } else if (type.startsWith('LAB_RM_')) {
      navigate(`/lab/test/${grnId}`, navigateOpts);
    } else if (type.startsWith('FINAL_QTY_')) {
      navigate(`/grn/view/${grnId}`, navigateOpts);
    } else if (type.startsWith('PRODUCTION_')) {
      if (type === 'PRODUCTION_COMPLETED') {
        navigate(`/production/qc-queue`, navigateOpts);
      } else {
        navigate(`/production/batches`, navigateOpts);
      }
    } else if (type.includes('STOCK_') || type.includes('LOW_STOCK')) {
      if (type.startsWith('RM_')) {
        navigate(`/rm/stock/low`, navigateOpts);
      } else {
        navigate(`/products/low-stock`, navigateOpts);
      }
    }
  };

  const getFilteredNotifications = () => {
    return notifications.filter(notif => {
      // 1. Search Query
      const matchesSearch = notif.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notif.type.toLowerCase().replace(/_/g, ' ').includes(searchTerm.toLowerCase());
      
      // 2. Status
      const matchesStatus = 
        statusFilter === 'ALL' ||
        (statusFilter === 'UNREAD' && !notif.seenAt) ||
        (statusFilter === 'READ' && notif.seenAt);

      // 3. Type category
      let matchesType = true;
      if (typeFilter !== 'ALL') {
        if (typeFilter === 'PO') matchesType = notif.type.startsWith('PO_');
        else if (typeFilter === 'GRN') matchesType = notif.type.startsWith('GRN_');
        else if (typeFilter === 'LAB') matchesType = notif.type.startsWith('LAB_');
        else if (typeFilter === 'PRODUCTION') matchesType = notif.type.startsWith('PRODUCTION_') || notif.type === 'FINAL_QTY_SUBMITTED';
        else if (typeFilter === 'ALERTS') matchesType = notif.type.includes('STOCK_') || notif.type.includes('ALERT');
      }

      return matchesSearch && matchesStatus && matchesType;
    });
  };

  const filteredNotifications = getFilteredNotifications();
  const unreadFilteredCount = filteredNotifications.filter(n => !n.seenAt).length;
  const isAllSelected = unreadFilteredCount > 0 && filteredNotifications.filter(n => !n.seenAt).every(n => selectedIds.includes(n.id));

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-in fade-in duration-300">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2.5">
            <Bell className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            Notifications Center
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm">
            Stay informed with real-time operational alerts, quality controls, and purchase statuses.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={fetchNotifications}
            className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-750 rounded-xl transition duration-200 flex items-center justify-center focus:outline-none"
            title="Refresh notifications"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {notifications.some(n => !n.seenAt) && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 rounded-xl text-sm font-semibold transition duration-250 focus:outline-none"
            >
              Mark all as read
            </button>
          )}

          {selectedIds.length > 0 && (
            <button
              onClick={handleMarkSelectedAsRead}
              className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md transition duration-255 flex items-center gap-1.5 animate-in slide-in-from-right-3 focus:outline-none"
            >
              <Check className="w-4 h-4" />
              Mark selected ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Filter and search controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search notifications by message content or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white border border-slate-200 dark:border-slate-200 rounded-xl text-sm text-black dark:text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:focus:ring-indigo-400/25 focus:border-indigo-500 transition duration-150"
            />
          </div>

          {/* Status filters */}
          <div className="flex bg-slate-50 dark:bg-slate-850 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800 shrink-0">
            {['ALL', 'UNREAD', 'READ'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                  statusFilter === status
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/10'
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
              className="w-full md:w-auto flex items-center justify-between gap-3.5 px-4 py-2.5 bg-slate-950 dark:bg-black hover:bg-slate-900 dark:hover:bg-slate-950 text-white border border-slate-900 dark:border-neutral-900 rounded-xl text-xs font-bold uppercase tracking-wider transition duration-150 focus:outline-none min-w-[200px]"
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
                    className={`w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs font-semibold hover:bg-indigo-50/50 dark:hover:bg-slate-800 transition-colors ${
                      typeFilter === cat.value
                        ? 'text-indigo-650 dark:text-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/10'
                        : 'text-slate-600 dark:text-slate-350'
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden">
        {filteredNotifications.length > 0 && (
          <div className="px-5 py-3.5 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <button
              onClick={() => toggleSelectAll(filteredNotifications)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition focus:outline-none"
              title="Select all unread"
            >
              {isAllSelected ? (
                <CheckSquare className="w-5 h-5 text-indigo-650 dark:text-indigo-400" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Select all unread in this view
            </span>
          </div>
        )}

        <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
          {loading && notifications.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center">
              <RefreshCw className="w-10 h-10 animate-spin text-indigo-600 mb-3" />
              <p className="text-sm font-medium text-slate-550">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center">
              <Bell className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3.5" />
              <p className="text-base font-semibold text-slate-800 dark:text-slate-200">No notifications match filters</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 max-w-md">
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
                  className={`p-5 transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 relative group ${
                    isUnread 
                      ? 'bg-indigo-50/20 dark:bg-indigo-950/10 border-l-[3.5px] border-l-indigo-650 dark:border-l-indigo-500 pl-4' 
                      : 'pl-5'
                  } ${isLabMuted ? 'opacity-55' : ''}`}
                >
                  <div className="flex items-start gap-4 flex-1">
                    
                    {/* Checkbox for unread */}
                    {isUnread ? (
                      <button
                        onClick={() => toggleSelect(notif.id)}
                        className="mt-1 shrink-0 text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 transition focus:outline-none"
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
                    <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-200/50 dark:border-slate-700 shrink-0">
                      {getCategoryIcon(notif.type)}
                    </div>

                    {/* Message detail */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-block text-[9.5px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border shrink-0 ${PhaseColors[notif.type] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-250 dark:border-slate-700'}`}>
                          {notif.type.replace(/_/g, ' ')}
                        </span>
                        
                        <span className="text-[11px] text-slate-450 dark:text-slate-500 font-medium" title={new Date(notif.eventAt).toLocaleString()}>
                          • {relativeTime(notif.eventAt)}
                        </span>
                      </div>
                      
                      <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed max-w-3xl">
                        {notif.message}
                      </p>
                      
                      {/* Seen receipt log */}
                      {notif.seenAt && notif.userSeenBy && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 pt-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Seen by {notif.userSeenBy.name} ({notif.userSeenBy.role.replace('_', ' ')}) at {new Date(notif.seenAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions column */}
                  <div className="flex items-center gap-2 self-end md:self-auto pl-9 md:pl-0 shrink-0">
                    
                    {/* Mark as read button */}
                    {isUnread && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-650 dark:text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-150 dark:hover:border-indigo-900/40 transition focus:outline-none"
                      >
                        Mark as read
                      </button>
                    )}

                    {/* Context link (PO, GRN, etc) */}
                    <button
                      onClick={() => handleNavigateToContext(notif)}
                      className="px-3 py-1.5 text-xs font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg border border-indigo-100/45 dark:border-indigo-900/20 transition flex items-center gap-1.5 focus:outline-none"
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

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/10 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing page {page} of {totalPages} ({totalItems} total alerts)
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent text-slate-500 transition duration-150 focus:outline-none"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                disabled={page >= totalPages || loading}
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent text-slate-500 transition duration-150 focus:outline-none"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default NotificationsListPage;
