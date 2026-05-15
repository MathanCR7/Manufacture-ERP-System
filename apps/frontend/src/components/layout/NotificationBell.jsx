import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, Circle, ExternalLink, Activity, Package, AlertTriangle, XCircle, FlaskConical } from 'lucide-react';
import useAuthStore from '@/app/store/authStore';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';

const PhaseColors = {
  PO_CREATED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200',
  GRN_SUBMITTED: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200',
  LAB_RM_APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200',
  LAB_RM_REJECTED: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200',
  LAB_RM_RESAMPLE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200',
  FINAL_QTY_SUBMITTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200',
  PRODUCTION_STARTED: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-400 border-fuchsia-200',
  PRODUCTION_COMPLETED: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-400 border-fuchsia-200',
  PRODUCTION_QC_PASSED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200',
  PRODUCTION_QC_FAILED: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200',
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
      'PO_CREATED', 'PO_AMENDED', 'PO_CANCELLED', 
      'GRN_SUBMITTED', 'LAB_RM_APPROVED', 'LAB_RM_REJECTED', 
      'LAB_RM_RESAMPLE', 'FINAL_QTY_SUBMITTED', 'PRODUCTION_STARTED', 
      'PRODUCTION_ON_HOLD', 'PRODUCTION_COMPLETED', 'PRODUCTION_QC_PASSED', 
      'PRODUCTION_QC_FAILED', 'STOCK_LOW_ALERT', 'STOCK_EXPIRY_ALERT'
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
    if (type === 'PO_CREATED') {
      if (role === 'MAIN_MASTER' || role === 'SUPERVISOR') {
        return (
          <div className="bg-indigo-50 p-3 rounded-md border border-indigo-200 cursor-pointer hover:bg-indigo-100" onClick={(e) => handleActionClick(e, `/po/${metadata.po_id}`)}>
            <p className="text-sm font-medium text-indigo-900 mb-2">{message}</p>
            <div className="flex space-x-2">
              <button 
                onClick={(e) => handleActionClick(e, `/po/${metadata.po_id}`)}
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
          <div className="bg-indigo-50 p-3 rounded-md border border-indigo-200 cursor-pointer hover:bg-indigo-100" onClick={(e) => handleActionClick(e, `/po/${metadata.po_id}`)}>
            <p className="text-sm font-medium text-indigo-900 mb-2">Prepare receiving bay for RM #{metadata.rm_id}</p>
            <button 
              onClick={(e) => handleActionClick(e, `/po/${metadata.po_id}`)}
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
        className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[100vw] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-2 z-50 flex flex-col max-h-[80vh]">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Notifications</h3>
            {unreadCount > 0 && (
              <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">
                {unreadCount} new
              </span>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-600">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                <Activity className="w-8 h-8 mb-2 opacity-20" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isReturned = notif.type === 'GRN_SUBMITTED' && (notif.metadata.confirmation_status === 'Returned' || notif.metadata.confirmation_status === 'RETURNED');
                const isLabMuted = isReturned && user.role === 'LAB_ASSISTANT';
                
                return (
                  <div 
                    key={notif.id}
                    onClick={() => handleOpen(notif)}
                    className={`p-4 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${!notif.seenAt && !isLabMuted ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''} ${isLabMuted ? 'opacity-70 bg-slate-50/50' : ''} ${notif.seenAt ? 'opacity-80' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${PhaseColors[notif.type] || 'bg-slate-100 text-slate-600'}`}>
                        {notif.type.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-400">
                          {new Date(notif.eventAt).toLocaleString(undefined, {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                        {notif.seenAt ? (
                          <div className="flex items-center text-emerald-500" title={`Seen at ${new Date(notif.seenAt).toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}>
                            <span className="text-[10px] mr-1 opacity-75">{new Date(notif.seenAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : (
                          <Circle className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                    </div>
                    
                    {renderNotificationContent(notif)}
                    
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Toast Overlay */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toastNotifs.map(t => (
          <div key={t.toastId} className={`pointer-events-auto w-80 shadow-lg rounded-lg border p-4 bg-white dark:bg-slate-800 ${PhaseColors[t.type]?.split(' ')[3] || 'border-slate-200'}`}>
            <div className="flex justify-between items-start mb-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${PhaseColors[t.type] || 'bg-slate-100 text-slate-600'}`}>
                {t.type.replace(/_/g, ' ')}
              </span>
              <button onClick={() => setToastNotifs(prev => prev.filter(x => x.toastId !== t.toastId))} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{t.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationBell;
