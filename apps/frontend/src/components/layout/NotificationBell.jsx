import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, Circle, ExternalLink, Activity, Package, AlertTriangle, XCircle, FlaskConical } from 'lucide-react';
import useAuthStore from '@/app/store/authStore';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';

const PhaseColors = {
  PO_CREATED: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/30',
  PO_UPDATED: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800/30',
  PO_AMENDED: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800/30',
  PO_CANCELLED: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/30',
  PO_STATUS_CHANGED: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/30',
  
  GRN_SUBMITTED: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/30',
  
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
  STOCK_CRITICAL: 'bg-rose-50 text-rose-705 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/30',
  STOCK_REORDER: 'bg-amber-50 text-amber-707 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/30',
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

const NotificationBell = () => {
  const user = useAuthStore(state => state.user);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [toastNotifs, setToastNotifs] = useState([]);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch initial notifications
    api.get('/notifications').then(res => {
      setNotifications(res.data);
    }).catch(err => console.error("Failed to fetch notifications", err));

    // Connect SSE
    const token = useAuthStore.getState().token;
    const eventSource = new EventSource(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/notifications/stream?token=${token}`);

    const handleEvent = (event) => {
      const newNotif = JSON.parse(event.data);
      setNotifications(prev => [newNotif, ...prev]);
      
      // Show Toast
      const toastId = Date.now();
      setToastNotifs(prev => [...prev, { ...newNotif, toastId }]);
      setTimeout(() => {
        setToastNotifs(prev => prev.filter(t => t.toastId !== toastId));
      }, newNotif.type.includes('QC_PASSED') || newNotif.type.includes('ALERT') ? 10000 : 6000);

      // Dispatch custom event for widgets to listen to
      window.dispatchEvent(new CustomEvent('notification-received', { detail: newNotif }));
    };

    // Listen to all specific events
    const events = [
      'PO_CREATED', 'PO_AMENDED', 'PO_CANCELLED', 'PO_UPDATED', 'PO_STATUS_CHANGED',
      'GRN_SUBMITTED', 'LAB_RM_APPROVED', 'LAB_RM_REJECTED', 
      'LAB_RM_RESAMPLE', 'FINAL_QTY_SUBMITTED', 'PRODUCTION_STARTED', 
      'PRODUCTION_ON_HOLD', 'PRODUCTION_COMPLETED', 'PRODUCTION_QC_PASSED', 
      'PRODUCTION_QC_FAILED', 'STOCK_LOW_ALERT', 'STOCK_EXPIRY_ALERT',
      'STOCK_CRITICAL', 'STOCK_REORDER', 'RM_LOW_STOCK_ALERT'
    ];
    events.forEach(e => eventSource.addEventListener(e, handleEvent));

    return () => {
      events.forEach(e => eventSource.removeEventListener(e, handleEvent));
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getNotificationUrl = (notif) => {
    const { type, metadata, referenceId } = notif;
    const poId = metadata?.po_id || referenceId;
    const grnId = metadata?.grn_id || referenceId;
    const batchId = metadata?.batch_id || referenceId;

    if (type.startsWith('PO_')) {
      return `/purchase-orders/${poId}`;
    }
    if (type.startsWith('GRN_')) {
      return `/grn/view/${grnId}`;
    }
    if (type.startsWith('LAB_RM_')) {
      return `/lab/test/${grnId}`;
    }
    if (type.startsWith('FINAL_QTY_')) {
      return `/grn/view/${grnId}`;
    }
    if (type.startsWith('PRODUCTION_')) {
      if (type === 'PRODUCTION_COMPLETED') {
        return `/production/qc-queue`;
      }
      return `/production/batches`;
    }
    if (type.includes('STOCK_') || type.includes('LOW_STOCK')) {
      if (type.startsWith('RM_')) {
        return `/rm/stock/low`;
      } else {
        return `/products/low-stock`;
      }
    }
    return null;
  };

  const handleOpen = async (notif) => {
    if (!notif.seenAt) {
      try {
        await api.patch(`/notifications/${notif.id}/seen`);
        setNotifications(prev => prev.map(n => 
          n.id === notif.id ? { ...n, seenAt: new Date().toISOString() } : n
        ));
      } catch (err) {
        console.error("Failed to mark as seen", err);
      }
    }

    const targetUrl = getNotificationUrl(notif);
    if (targetUrl) {
      navigate(targetUrl);
      setIsOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/seen-all');
      setNotifications(prev => prev.map(n => ({
        ...n,
        seenAt: n.seenAt || new Date().toISOString()
      })));
    } catch (err) {
      console.error("Failed to mark all as seen", err);
    }
  };

  const handleActionClick = (e, url) => {
    e.stopPropagation();
    navigate(url);
    setIsOpen(false);
  };

  const unreadCount = notifications.filter(n => !n.seenAt).length;

  const renderNotificationContent = (notif) => {
    const { type, metadata, message, eventAt } = notif;
    const role = user.role;

    // Phase 1: PO CREATED
    if (type === 'PO_CREATED' || type === 'PO_UPDATED' || type === 'PO_STATUS_CHANGED') {
      if (role === 'MAIN_MASTER' || role === 'SUPERVISOR' || role === 'PURCHASE_ACCOUNTANT') {
        return (
          <div className="bg-indigo-50 p-3 rounded-md border border-indigo-200 cursor-pointer hover:bg-indigo-100" onClick={(e) => handleActionClick(e, `/purchase-orders/${metadata.po_id}`)}>
            <p className="text-sm font-medium text-indigo-900 mb-2">{message}</p>
            <div className="flex space-x-2">
              <button 
                onClick={(e) => handleActionClick(e, `/purchase-orders/${metadata.po_id}`)}
                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 flex items-center shadow-sm"
              >
                View PO Details
              </button>
            </div>
          </div>
        );
      }
      if (role === 'MATERIALS_RECEIVER') {
        return (
          <div className="bg-indigo-50 p-3 rounded-md border border-indigo-200 cursor-pointer hover:bg-indigo-100" onClick={(e) => handleActionClick(e, `/purchase-orders/${metadata.po_id}`)}>
            <p className="text-sm font-medium text-indigo-900 mb-2">{message}</p>
            <button 
              onClick={(e) => handleActionClick(e, `/purchase-orders/${metadata.po_id}`)}
              className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 flex items-center shadow-sm"
            >
              View PO
            </button>
          </div>
        );
      }
    }

    // Phase 2: GRN Submitted
    if (type === 'GRN_SUBMITTED') {
      const isReturned = metadata.confirmation_status === 'Returned' || metadata.confirmation_status === 'RETURNED';
      
      if (role === 'PURCHASE_ACCOUNTANT') {
        return (
          <div className={isReturned ? "bg-red-50 p-2 rounded-md border border-red-200" : ""}>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{message}</p>
          </div>
        );
      }
      
      if (role === 'LAB_ASSISTANT') {
        if (isReturned) {
          return (
            <div className="bg-slate-100 p-3 rounded-md text-slate-500 italic border border-slate-200">
              <p className="text-sm">RM #{metadata.rm_id} returned to supplier — no testing required</p>
            </div>
          );
        } else {
          return (
            <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
              <p className="text-sm font-medium text-blue-900 mb-2">RM #{metadata.rm_id} has arrived — ready for testing</p>
              <button 
                onClick={(e) => handleActionClick(e, `/lab/rm-test/${metadata.grn_id}`)}
                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 flex items-center shadow-sm"
              >
                <FlaskConical className="w-3 h-3 mr-1" /> Start Test
              </button>
            </div>
          );
        }
      }
    }

    // Phase 3: LAB RM APPROVED
    if (type === 'LAB_RM_APPROVED') {
      if (role === 'MATERIALS_RECEIVER') {
        return (
          <div>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">{message}</p>
            <button 
              onClick={(e) => handleActionClick(e, `/grn/${metadata.grn_id}/final-qty`)}
              className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 flex items-center"
            >
              Enter Final Approved Quantity
            </button>
          </div>
        );
      }
      if (role === 'PRODUCTION_STAFF') {
        return (
          <div className="bg-emerald-50 p-3 rounded-md border border-emerald-200">
            <p className="text-sm font-medium text-emerald-900 mb-2">RM #{metadata.rm_id} · {metadata.rm_name} approved — ready to plan production</p>
            <button 
              onClick={(e) => handleActionClick(e, `/production/rm/${metadata.rm_id}`)}
              className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-md hover:bg-emerald-700 flex items-center shadow-sm"
            >
              Plan Production
            </button>
          </div>
        );
      }
    }

    // Phase 3: LAB RM REJECTED
    if (type === 'LAB_RM_REJECTED' && role === 'MATERIALS_RECEIVER') {
      return (
        <div>
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">{message}</p>
          <button 
            onClick={(e) => handleActionClick(e, `/grn/${metadata.grn_id || metadata.rm_id}/return`)}
            className="text-xs bg-rose-600 text-white px-3 py-1.5 rounded-md hover:bg-rose-700 flex items-center"
          >
            Manage Return / Hold
          </button>
        </div>
      );
    }

    // Phase 3: LAB RM RESAMPLE
    if (type === 'LAB_RM_RESAMPLE' && role === 'MATERIALS_RECEIVER') {
      return (
        <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
          <p className="text-sm font-medium text-amber-900 mb-2">Lab requires a new sample for RM #{metadata.rm_id}</p>
          <button 
            onClick={(e) => handleActionClick(e, `/grn/${metadata.grn_id}/sample`)}
            className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-md hover:bg-amber-700 flex items-center shadow-sm"
          >
            Send Sample
          </button>
        </div>
      );
    }

    // Phase 3b: FINAL QTY SUBMITTED
    if (type === 'FINAL_QTY_SUBMITTED' && role === 'PRODUCTION_STAFF') {
      return (
        <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
          <p className="text-sm font-medium text-blue-900">
            RM #{metadata.rm_id} · {metadata.rm_name} — {metadata.final_approved_qty} {metadata.uom} queued for production
          </p>
        </div>
      );
    }

    // Phase 4: PRODUCTION STARTED
    if (type === 'PRODUCTION_STARTED' && role === 'LAB_ASSISTANT') {
      return (
        <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
          <p className="text-sm font-medium text-slate-700">Batch #{metadata.batch_id} in progress — prepare for QC</p>
        </div>
      );
    }

    // Phase 4: PRODUCTION COMPLETED
    if (type === 'PRODUCTION_COMPLETED' && role === 'LAB_ASSISTANT') {
      const eventTime = new Date(eventAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return (
        <div className="bg-indigo-50 p-3 rounded-md border border-indigo-200">
          <p className="text-sm font-medium text-indigo-900 mb-2">Batch #{metadata.batch_id} completed at {eventTime} — QC test required</p>
          <button 
            onClick={(e) => handleActionClick(e, `/lab/production/${metadata.batch_id}`)}
            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 flex items-center shadow-sm"
          >
            Start QC Test
          </button>
        </div>
      );
    }

    // Phase 5: PRODUCTION QC PASSED
    if (type === 'PRODUCTION_QC_PASSED') {
      if (role === 'PRODUCTION_STAFF') {
        return (
          <div className="bg-emerald-50 p-3 rounded-md border border-emerald-200">
            <p className="text-sm font-medium text-emerald-900">Batch #{metadata.batch_id} passed QC — stock handed to sales</p>
          </div>
        );
      }
      if (role === 'SALES_TEAM') {
        const availableSince = new Date(eventAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        return (
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 rounded-lg shadow-md text-white mt-2 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-10">
              <Package className="w-24 h-24" />
            </div>
            <h4 className="font-bold text-lg mb-2 flex items-center">
              <CheckCircle2 className="w-5 h-5 mr-2" /> New Stock Available
            </h4>
            <div className="space-y-1 text-sm font-medium opacity-90 mb-3">
              <p>Batch #{metadata.batch_id} · {metadata.product_name}</p>
              <p>Qty: {metadata.approved_qty} pcs</p>
              <p>Expiry: {metadata.expiry_date}</p>
              <p>QC Ref: {metadata.qc_test_id}</p>
              <p className="text-xs mt-2 opacity-75">Available since: {availableSince}</p>
            </div>
            <button 
              onClick={(e) => handleActionClick(e, `/stock/ready/${metadata.batch_id}`)}
              className="text-sm bg-white text-emerald-700 px-4 py-2 rounded-md hover:bg-slate-50 flex items-center font-bold shadow-sm transition-colors"
            >
              View Stock <ExternalLink className="w-4 h-4 ml-2" />
            </button>
          </div>
        );
      }
    }

    // Phase 5: PRODUCTION QC FAILED
    if (type === 'PRODUCTION_QC_FAILED' && role === 'PRODUCTION_STAFF') {
      const eventTime = new Date(eventAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return (
        <div className="bg-rose-50 p-3 rounded-md border border-rose-200 mt-2">
          <h4 className="text-rose-800 font-bold flex items-center text-sm mb-1">
            <AlertTriangle className="w-4 h-4 mr-1.5" /> Action Required
          </h4>
          <p className="text-sm font-medium text-rose-900 mb-2">Batch #{metadata.batch_id} failed QC at {eventTime} — review required. Reason: {metadata.notes}</p>
          <div className="flex space-x-2 mt-3">
            <button 
              onClick={(e) => handleActionClick(e, `/production/discard/${metadata.batch_id}`)}
              className="text-xs bg-rose-600 text-white px-3 py-1.5 rounded-md hover:bg-rose-700 flex items-center shadow-sm"
            >
              <XCircle className="w-3.5 h-3.5 mr-1" /> Discard
            </button>
            <button 
              onClick={(e) => handleActionClick(e, `/production/reprocess/${metadata.batch_id}`)}
              className="text-xs bg-white text-rose-700 border border-rose-200 px-3 py-1.5 rounded-md hover:bg-rose-50 flex items-center shadow-sm"
            >
              <Activity className="w-3.5 h-3.5 mr-1" /> Re-process
            </button>
          </div>
        </div>
      );
    }

    // Default rendering for unhandled specific roles/types
    return (
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        {message}
      </p>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative focus:outline-none"
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-indigo-650 dark:bg-indigo-500 rounded-full border border-white dark:border-slate-900 animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-[420px] max-w-[95vw] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-800 py-2.5 z-50 flex flex-col max-h-[85vh] animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 text-[11px] px-2 py-0.5 rounded-full font-bold shadow-sm">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllRead} 
                className="text-xs text-indigo-650 dark:text-indigo-400 hover:text-indigo-850 dark:hover:text-indigo-300 font-semibold transition-colors bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/20"
              >
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 max-h-[50vh]">
            {notifications.length === 0 ? (
              <div className="p-10 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center">
                <Bell className="w-10 h-10 mb-3 opacity-20 text-indigo-500" />
                <p className="text-sm font-medium">All caught up!</p>
                <p className="text-xs mt-1 text-slate-500 dark:text-slate-500">No notifications available</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isReturned = notif.type === 'GRN_SUBMITTED' && (notif.metadata.confirmation_status === 'Returned' || notif.metadata.confirmation_status === 'RETURNED');
                const isLabMuted = isReturned && user.role === 'LAB_ASSISTANT';
                const isUnread = !notif.seenAt && !isLabMuted;
                
                return (
                  <div 
                    key={notif.id}
                    onClick={() => handleOpen(notif)}
                    className={`p-4 border-b border-slate-50 dark:border-slate-800/40 hover:bg-indigo-50/15 dark:hover:bg-slate-800/40 cursor-pointer transition-all duration-200 flex flex-col gap-2 relative ${isUnread ? 'bg-indigo-50/20 dark:bg-indigo-950/10 border-l-[3.5px] border-l-indigo-600 dark:border-l-indigo-500 pl-[12.5px]' : 'pl-4'} ${isLabMuted ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/50' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3 w-full">
                      <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border shrink-0 ${PhaseColors[notif.type] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                        {notif.type.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center space-x-2 shrink-0 text-slate-400 dark:text-slate-500">
                        <span className="text-[10px] font-medium" title={new Date(notif.eventAt).toLocaleString()}>
                          {relativeTime(notif.eventAt)}
                        </span>
                        {notif.seenAt ? (
                          <div className="flex items-center text-emerald-500 shrink-0" title={`Seen at ${new Date(notif.seenAt).toLocaleString()}`}>
                            <span className="text-[9px] mr-1 opacity-75">{new Date(notif.seenAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-slate-350 dark:text-slate-700 shrink-0" />
                        )}
                      </div>
                    </div>
                    
                    <div className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                      {renderNotificationContent(notif)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/10 text-center rounded-b-2xl">
            <button 
              onClick={(e) => handleActionClick(e, '/notifications')} 
              className="text-xs font-semibold text-indigo-650 dark:text-indigo-405 hover:text-indigo-850 dark:hover:text-indigo-300 transition-colors inline-flex items-center gap-1.5 py-1 px-3 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg"
            >
              View all notifications
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Toast Overlay */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toastNotifs.map(t => (
          <div key={t.toastId} className={`pointer-events-auto w-85 shadow-2xl rounded-xl border p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-all duration-300 animate-in slide-in-from-right-5 ${PhaseColors[t.type]?.split(' ')[3] || 'border-slate-200 dark:border-slate-800'}`}>
            <div className="flex justify-between items-start mb-2.5">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${PhaseColors[t.type] || 'bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-400'}`}>
                {t.type.replace(/_/g, ' ')}
              </span>
              <button onClick={() => setToastNotifs(prev => prev.filter(x => x.toastId !== t.toastId))} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-350">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug font-medium">{t.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationBell;
