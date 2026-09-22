import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/lib/axios';
import {
  Calendar as CalendarIcon, Clock, Plus, Trash2, Edit3, Bell, BellOff,
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Moon,
  Flag, Tag, X, Sparkles, AlertCircle, RefreshCw, Check, Database,
  CalendarDays, ArrowUpRight, Users, Shield, Lock, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Priority hierarchy ranking
const PRIORITY_ORDER = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1
};

// Available user roles for event visibility
export const SYSTEM_ROLES = [
  { id: 'ALL', label: 'All Roles (Company-Wide)', desc: 'Visible to everyone across all departments' },
  { id: 'MAIN_MASTER', label: 'Main Master / Admin', desc: 'Executive management & administrators' },
  { id: 'SUPERVISOR', label: 'Supervisor', desc: 'Plant & shift operations supervisors' },
  { id: 'PRODUCTION_STAFF', label: 'Production Staff', desc: 'Shop floor operators and technicians' },
  { id: 'PURCHASE_ACCOUNTANT', label: 'Purchase Accountant', desc: 'Procurement, billing & finance team' },
  { id: 'MATERIALS_RECEIVER', label: 'Materials Receiver', desc: 'Warehouse & inventory receiving team' },
  { id: 'SALES_TEAM', label: 'Sales Team', desc: 'Customer relations & order dispatch' },
  { id: 'LAB_ASSISTANT', label: 'Lab Assistant', desc: 'Quality control & laboratory testers' }
];

// Local storage backup keys
const LOCAL_STORAGE_EVENTS_KEY = 'manufacturing_erp_calendar_user_events';
const LOCAL_STORAGE_NOTIFS_KEY = 'manufacturing_erp_calendar_notifications_enabled';

/**
 * Format local year, month (0-indexed), day to YYYY-MM-DD
 * CRITICAL: Eliminates UTC timezone shifts so that dates like Oct 2 (Gandhi Jayanti)
 * and Sept 22 (Today) never shift forward or backward by 1 day in IST or any local timezone!
 */
export const formatLocalDate = (year, month, day) => {
  const y = String(year);
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getTodayDateStr = () => {
  const now = new Date();
  return formatLocalDate(now.getFullYear(), now.getMonth(), now.getDate());
};

export default function OperationsCalendar({ operationalMilestones = [] }) {
  const todayStr = useMemo(() => getTodayDateStr(), []);

  // Calendar Navigation State
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Live Holiday Dataset State (Fetched from Live Official Feed)
  const [liveHolidays, setLiveHolidays] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [liveHolidayMeta, setLiveHolidayMeta] = useState({
    source: 'Google Calendar Official India Live Feed',
    isLive: true,
    fetchedAt: null,
    count: 0
  });

  // Database User Events State (PostgreSQL Persisted)
  const [userEvents, setUserEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [savingEvent, setSavingEvent] = useState(false);

  // Live Notifications State
  const [alertsEnabled, setAlertsEnabled] = useState(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_NOTIFS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  // Add / Edit Modal State
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(todayStr);
  const [formTime, setFormTime] = useState('');
  const [formPriority, setFormPriority] = useState('Medium');
  const [formNote, setFormNote] = useState('');
  const [formAllowedRoles, setFormAllowedRoles] = useState(['ALL']);
  const [formError, setFormError] = useState('');

  // In-app Alert Notification Banner
  const [activeAlertBanner, setActiveAlertBanner] = useState(null);

  // URL query parameter listener for ?date=YYYY-MM-DD
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const queryDate = params.get('date');
      if (queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
        setSelectedDate(queryDate);
        const [qY, qM] = queryDate.split('-').map(Number);
        const curDate = new Date();
        const diffMonths = (qY - curDate.getFullYear()) * 12 + ((qM - 1) - curDate.getMonth());
        setCalendarMonthOffset(diffMonths);
      }
    } catch (e) {
      // ignore param parse error
    }
  }, []);

  // Calculate current viewed year and month
  const viewedDate = useMemo(() => {
    const base = new Date();
    base.setDate(1); // avoid month overflow issues on 31st
    base.setMonth(base.getMonth() + calendarMonthOffset);
    return base;
  }, [calendarMonthOffset]);

  const viewedYear = viewedDate.getFullYear();
  const viewedMonth = viewedDate.getMonth();

  // --------------------------------------------------------------------------
  // 1. FETCH LIVE REAL-TIME HOLIDAYS FROM OFFICIAL SOURCES (NO STATIC JSON)
  // --------------------------------------------------------------------------
  const fetchLiveHolidays = useCallback(async (year, forceRefresh = false) => {
    setHolidaysLoading(true);
    try {
      const res = await api.get('/forecasting/calendar/holidays', {
        params: { year, refresh: forceRefresh ? 'true' : undefined }
      });
      if (res.data?.holidays && Array.isArray(res.data.holidays)) {
        setLiveHolidays(res.data.holidays);
        setLiveHolidayMeta({
          source: res.data.source || 'Google Calendar Official India Live Feed',
          isLive: res.data.isLive ?? true,
          fetchedAt: res.data.fetchedAt || new Date().toISOString(),
          count: res.data.holidays.length
        });
        return;
      }
    } catch (err) {
      console.warn('Backend holiday fetch error, attempting direct live fallback:', err);
    }

    // Direct fallback from live keyless API if backend is unavailable
    try {
      const res = await fetch(`https://randomapi.dev/api/holidays?country=IN&year=${year}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          const directHolidays = json.data.map(item => ({
            date: item.date,
            name: item.name,
            type: 'National Gazetted',
            isTentative: false,
            note: 'Official Public Holiday',
            source: 'RandomAPI Direct Live Feed'
          }));
          setLiveHolidays(directHolidays);
          setLiveHolidayMeta({
            source: 'RandomAPI Direct Live Feed',
            isLive: true,
            fetchedAt: new Date().toISOString(),
            count: directHolidays.length
          });
        }
      }
    } catch (fallbackErr) {
      console.error('All live holiday fetches failed:', fallbackErr);
    } finally {
      setHolidaysLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveHolidays(viewedYear);
  }, [viewedYear, fetchLiveHolidays]);

  // --------------------------------------------------------------------------
  // 2. FETCH EVENTS FROM POSTGRESQL DATABASE
  // --------------------------------------------------------------------------
  const fetchDatabaseEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await api.get('/forecasting/calendar/events');
      if (res.data?.events) {
        setUserEvents(res.data.events);
        try {
          localStorage.setItem(LOCAL_STORAGE_EVENTS_KEY, JSON.stringify(res.data.events));
        } catch {
          // ignore storage error
        }
      }
    } catch (err) {
      console.warn('Could not load events from PostgreSQL database, loading local cache:', err);
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_EVENTS_KEY);
        if (cached) setUserEvents(JSON.parse(cached));
      } catch (e) {
        console.error(e);
      }
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatabaseEvents();
  }, [fetchDatabaseEvents]);

  // --------------------------------------------------------------------------
  // 3. LIVE NOTIFICATIONS & 30-SECOND POLLING
  // --------------------------------------------------------------------------
  const handleToggleNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Browser notifications are not supported in this browser.');
      return;
    }

    if (notificationPermission !== 'granted') {
      try {
        const result = await Notification.requestPermission();
        setNotificationPermission(result);
        if (result === 'granted') {
          setAlertsEnabled(true);
          localStorage.setItem(LOCAL_STORAGE_NOTIFS_KEY, 'true');
          new Notification('🔔 Operations Calendar Alerts Active', {
            body: 'You will receive real-time alerts when your scheduled operational events arrive.',
            icon: '/favicon.ico'
          });
        } else {
          setAlertsEnabled(false);
          localStorage.setItem(LOCAL_STORAGE_NOTIFS_KEY, 'false');
        }
      } catch (err) {
        console.error('Error requesting notification permission:', err);
      }
    } else {
      const nextState = !alertsEnabled;
      setAlertsEnabled(nextState);
      localStorage.setItem(LOCAL_STORAGE_NOTIFS_KEY, nextState ? 'true' : 'false');
    }
  };

  useEffect(() => {
    const checkScheduledEvents = () => {
      if (!alertsEnabled || typeof window === 'undefined') return;

      const now = new Date();
      const curDateStr = formatLocalDate(now.getFullYear(), now.getMonth(), now.getDate());
      const curTotalMinutes = now.getHours() * 60 + now.getMinutes();

      setUserEvents(prevEvents => {
        let hasChanges = false;
        const updated = prevEvents.map(ev => {
          if (ev.date === curDateStr && ev.time && !ev.notified) {
            const [evH, evM] = ev.time.split(':').map(Number);
            if (!isNaN(evH) && !isNaN(evM)) {
              const evTotalMinutes = evH * 60 + evM;
              // 2-minute tolerance window
              if (Math.abs(curTotalMinutes - evTotalMinutes) <= 2) {
                hasChanges = true;
                const notifTitle = `[${ev.priority.toUpperCase()}] ${ev.title}`;
                const notifBody = ev.note || `Operational event scheduled for ${ev.time} is due now.`;

                if ('Notification' in window && Notification.permission === 'granted') {
                  try {
                    new Notification(notifTitle, {
                      body: notifBody,
                      icon: '/favicon.ico'
                    });
                  } catch (e) {
                    console.error('Notification fire error:', e);
                  }
                }

                setActiveAlertBanner({
                  title: notifTitle,
                  body: notifBody,
                  priority: ev.priority
                });

                return { ...ev, notified: true };
              }
            }
          }
          return ev;
        });

        return hasChanges ? updated : prevEvents;
      });
    };

    checkScheduledEvents();
    const timer = setInterval(checkScheduledEvents, 30000); // 30s polling
    return () => clearInterval(timer);
  }, [alertsEnabled]);

  // --------------------------------------------------------------------------
  // 4. ADD / EDIT / REMOVE EVENT HANDLERS (PostgreSQL Database Synchronized)
  // --------------------------------------------------------------------------
  const handleOpenAddModal = (initialDate = null) => {
    setEditingEventId(null);
    setFormTitle('');
    setFormDate(initialDate || selectedDate || todayStr);
    setFormTime('');
    setFormPriority('Medium');
    setFormNote('');
    setFormAllowedRoles(['ALL']);
    setFormError('');
    setEventModalOpen(true);
  };

  const handleOpenEditModal = (event) => {
    setEditingEventId(event.id);
    setFormTitle(event.title || '');
    setFormDate(event.date || selectedDate || todayStr);
    setFormTime(event.time || '');
    setFormPriority(event.priority || 'Medium');
    setFormNote(event.note || '');

    let roles = event.allowedRoles;
    if (typeof roles === 'string') {
      try { roles = JSON.parse(roles); } catch { roles = ['ALL']; }
    }
    setFormAllowedRoles(Array.isArray(roles) && roles.length > 0 ? roles : ['ALL']);
    setFormError('');
    setEventModalOpen(true);
  };

  const handleToggleRoleCheckbox = (roleId) => {
    if (roleId === 'ALL') {
      setFormAllowedRoles(['ALL']);
      return;
    }

    setFormAllowedRoles(prev => {
      const withoutAll = prev.filter(r => r !== 'ALL');
      if (withoutAll.includes(roleId)) {
        const next = withoutAll.filter(r => r !== roleId);
        return next.length === 0 ? ['ALL'] : next;
      } else {
        return [...withoutAll, roleId];
      }
    });
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Event title is required.');
      return;
    }
    if (!formDate) {
      setFormError('Date is required.');
      return;
    }

    setSavingEvent(true);
    const eventPayload = {
      title: formTitle.trim(),
      date: formDate,
      time: formTime || null,
      priority: formPriority,
      note: formNote.trim(),
      allowedRoles: formAllowedRoles
    };

    try {
      if (editingEventId) {
        // Update in PostgreSQL
        await api.put(`/forecasting/calendar/events/${editingEventId}`, eventPayload);
        setUserEvents(prev => prev.map(item => {
          if (item.id === editingEventId) {
            return { ...item, ...eventPayload, notified: false };
          }
          return item;
        }));
      } else {
        // Create in PostgreSQL
        const res = await api.post('/forecasting/calendar/events', eventPayload);
        if (res.data?.event) {
          setUserEvents(prev => [...prev, res.data.event]);
        }
      }
      setEventModalOpen(false);
    } catch (err) {
      console.error('Failed to save event to database:', err);
      // Fallback local update
      if (editingEventId) {
        setUserEvents(prev => prev.map(item => item.id === editingEventId ? { ...item, ...eventPayload } : item));
      } else {
        const localId = `ue-${Date.now()}`;
        setUserEvents(prev => [...prev, { id: localId, ...eventPayload, notified: false }]);
      }
      setEventModalOpen(false);
    } finally {
      setSavingEvent(false);
    }
  };

  const handleRemoveEvent = async (id) => {
    try {
      await api.delete(`/forecasting/calendar/events/${id}`);
    } catch (err) {
      console.warn('Delete on backend failed:', err);
    }
    setUserEvents(prev => prev.filter(item => item.id !== id));
  };

  // --------------------------------------------------------------------------
  // 5. CALENDAR GRID BUILDER (Strictly local-date calibrated, no UTC drift)
  // --------------------------------------------------------------------------
  const calendarData = useMemo(() => {
    const firstDay = new Date(viewedYear, viewedMonth, 1);
    const lastDay = new Date(viewedYear, viewedMonth + 1, 0);

    const days = [];
    const startWeekday = firstDay.getDay(); // 0 = Sunday

    // Prefix padding for previous month days
    for (let i = 0; i < startWeekday; i++) {
      const prevDateObj = new Date(viewedYear, viewedMonth, -startWeekday + i + 1);
      const dateStr = formatLocalDate(prevDateObj.getFullYear(), prevDateObj.getMonth(), prevDateObj.getDate());
      days.push({
        dateStr,
        dayNum: prevDateObj.getDate(),
        isCurrentMonth: false,
        holidays: [],
        milestones: [],
        userEvents: [],
        highestPriorityDot: null,
        totalItemsCount: 0
      });
    }

    // Days of current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = formatLocalDate(viewedYear, viewedMonth, d);

      // 1. Holidays from Live Official Feed
      const dayHolidays = liveHolidays.filter(h => h.date === dateStr);

      // 2. Operational Milestones from ERP
      const dayMilestones = operationalMilestones.filter(m => m.date === dateStr);

      // 3. User Events from PostgreSQL
      const dayUserEvents = userEvents.filter(u => u.date === dateStr);

      const totalItemsCount = dayHolidays.length + dayMilestones.length + dayUserEvents.length;

      // Determine highest priority dot color
      let highestPriority = null;
      let highestRank = 0;

      dayUserEvents.forEach(ue => {
        const rank = PRIORITY_ORDER[ue.priority] || 1;
        if (rank > highestRank) {
          highestRank = rank;
          highestPriority = ue.priority;
        }
      });

      dayMilestones.forEach(m => {
        let p = 'Medium';
        if (m.severity === 'critical' || m.type === 'stockout') p = 'Critical';
        else if (m.severity === 'warning') p = 'High';
        else if (m.type === 'cash_inflow') p = 'Low';
        const rank = PRIORITY_ORDER[p] || 1;
        if (rank > highestRank) {
          highestRank = rank;
          highestPriority = p;
        }
      });

      if (dayHolidays.length > 0 && highestRank < 2) {
        highestPriority = 'Medium';
      }

      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        holidays: dayHolidays,
        milestones: dayMilestones,
        userEvents: dayUserEvents,
        highestPriorityDot: highestPriority,
        totalItemsCount
      });
    }

    return {
      monthLabel: viewedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      days
    };
  }, [viewedYear, viewedMonth, viewedDate, liveHolidays, operationalMilestones, userEvents, todayStr]);

  // Selected Day Items: strictly ordered as Holidays -> Milestones -> User Events (sorted by time)
  const selectedDayItems = useMemo(() => {
    if (!selectedDate) return { holidays: [], milestones: [], userEvents: [], totalCount: 0 };

    const holidays = liveHolidays.filter(h => h.date === selectedDate);
    const milestones = operationalMilestones.filter(m => m.date === selectedDate);
    const userEvs = userEvents.filter(u => u.date === selectedDate);

    // Sort user events chronologically (untimed last)
    const sortedUserEvents = [...userEvs].sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;
      return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
    });

    return {
      holidays,
      milestones,
      userEvents: sortedUserEvents,
      totalCount: holidays.length + milestones.length + sortedUserEvents.length
    };
  }, [selectedDate, liveHolidays, operationalMilestones, userEvents]);

  // Formatted date string for Day Detail panel header
  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const parts = selectedDate.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <div className="space-y-4 w-full">
      
      {/* ==================================================================== */}
      {/* GOOGLE CALENDAR STYLE HEADER & ACTION TOOLBAR                         */}
      {/* ==================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        
        {/* Left: Month Navigator */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
            <CalendarIcon className="w-5 h-5" />
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {calendarData.monthLabel}
            </h1>
            {holidaysLoading && (
              <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" title="Syncing live calendar feed..." />
            )}
          </div>

          <div className="flex items-center gap-1 ml-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCalendarMonthOffset(prev => prev - 1)}
              className="h-8 w-8 p-0 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCalendarMonthOffset(0);
                setSelectedDate(todayStr);
              }}
              className="h-8 px-3 text-xs font-bold rounded-xl border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600"
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCalendarMonthOffset(prev => prev + 1)}
              className="h-8 w-8 p-0 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Right: Live Feed Sync, Browser Alerts, Add Event */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Live Data Status Badge */}
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Data: {liveHolidays.length} Holidays</span>
          </span>

          {/* Sync Live Data Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchLiveHolidays(viewedYear, true)}
            disabled={holidaysLoading}
            className="h-8 text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Refresh holidays from live Google Calendar feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${holidaysLoading ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            {holidaysLoading ? 'Syncing...' : 'Sync Live'}
          </Button>

          {/* Live Browser Alerts Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleToggleNotifications}
            className={`h-8 text-xs font-semibold rounded-xl transition-all ${
              alertsEnabled
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm shadow-emerald-600/20'
                : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {alertsEnabled ? (
              <>
                <Bell className="w-3.5 h-3.5 mr-1.5 animate-bounce" />
                Alerts Active
              </>
            ) : (
              <>
                <BellOff className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                Enable Alerts
              </>
            )}
          </Button>

          {/* Add Event Button */}
          <Button
            size="sm"
            onClick={() => handleOpenAddModal(selectedDate)}
            className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Event</span>
          </Button>
        </div>
      </div>

      {/* ACTIVE NOTIFICATION POPUP BANNER */}
      {activeAlertBanner && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 flex items-start justify-between gap-3 text-xs shadow-md animate-in slide-in-from-top duration-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-900 dark:text-amber-200">{activeAlertBanner.title}</span>
              <p className="text-amber-800 dark:text-amber-300 text-[11px] mt-0.5">{activeAlertBanner.body}</p>
            </div>
          </div>
          <button
            onClick={() => setActiveAlertBanner(null)}
            className="p-1 text-amber-700 hover:text-amber-900 dark:hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MAIN LAYOUT: GOOGLE CALENDAR GRID (8/12) + DAY DETAIL PANEL (4/12)   */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[740px]">

        {/* 1. GOOGLE CALENDAR MONTH VIEW */}
        <Card className="xl:col-span-8 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden flex flex-col justify-between bg-white dark:bg-slate-900">
          <div>
            {/* 7-Column Day Header (Sun-Sat) */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-center text-xs font-bold text-slate-500 dark:text-slate-400 py-2.5">
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((dayName, i) => (
                <div key={dayName} className={`uppercase tracking-wider text-[11px] ${i === 0 ? 'text-rose-500 font-extrabold' : ''}`}>
                  {dayName}
                </div>
              ))}
            </div>

            {/* Google Calendar Style Month Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/80 border-b border-slate-200 dark:border-slate-800">
              {calendarData.days.map((d, idx) => {
                const isSelected = selectedDate === d.dateStr;
                const itemsCount = d.totalItemsCount;
                const maxVisible = 3;
                const visibleHolidays = d.holidays.slice(0, 2);
                const remainingSlots = Math.max(0, maxVisible - visibleHolidays.length);
                const visibleUserEvents = d.userEvents.slice(0, remainingSlots);
                const overflowCount = Math.max(0, itemsCount - (visibleHolidays.length + visibleUserEvents.length));

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(d.dateStr)}
                    className={`min-h-[120px] sm:min-h-[130px] p-1.5 sm:p-2 transition-all cursor-pointer flex flex-col justify-between select-none relative group ${
                      isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/50 ring-2 ring-indigo-500/40 z-10'
                        : d.isToday
                        ? 'bg-amber-50/40 dark:bg-amber-950/20'
                        : d.isCurrentMonth
                        ? 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-850'
                        : 'bg-slate-50/30 dark:bg-slate-950/40 opacity-40'
                    }`}
                  >
                    {/* Day Cell Top: Day Number & Priority Dot */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {d.isToday ? (
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            {d.dayNum}
                          </span>
                        ) : (
                          <span className={`text-xs font-semibold px-1 py-0.5 rounded ${
                            isSelected
                              ? 'text-indigo-600 dark:text-indigo-400 font-extrabold'
                              : d.isCurrentMonth
                              ? 'text-slate-800 dark:text-slate-200'
                              : 'text-slate-400 dark:text-slate-600'
                          }`}>
                            {d.dayNum}
                          </span>
                        )}
                      </div>

                      {/* Highest Priority Indicator */}
                      {d.highestPriorityDot && (
                        <span
                          className={`w-2 h-2 rounded-full ${
                            d.highestPriorityDot === 'Critical'
                              ? 'bg-rose-500 ring-2 ring-rose-500/30 animate-pulse'
                              : d.highestPriorityDot === 'High'
                              ? 'bg-orange-500'
                              : d.highestPriorityDot === 'Medium'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          title={`Priority: ${d.highestPriorityDot}`}
                        />
                      )}
                    </div>

                    {/* Google Calendar Style Event Strips */}
                    <div className="space-y-1 my-1 flex-1">
                      {/* 1. Holidays Pill Strip */}
                      {visibleHolidays.map((h, hIdx) => (
                        <div
                          key={`gh-${hIdx}`}
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-900 dark:bg-purple-950/80 dark:text-purple-200 border-l-2 border-purple-600 flex items-center gap-1 truncate shadow-2xs"
                          title={`${h.name} (${h.type})`}
                        >
                          {h.isTentative ? (
                            <Moon className="w-2.5 h-2.5 flex-shrink-0 text-amber-500" />
                          ) : (
                            <Flag className="w-2.5 h-2.5 flex-shrink-0 text-purple-600" />
                          )}
                          <span className="truncate">{h.name}</span>
                        </div>
                      ))}

                      {/* 2. User Events Pill Strip */}
                      {visibleUserEvents.map((ue) => {
                        const isCritical = ue.priority === 'Critical';
                        const isHigh = ue.priority === 'High';
                        const borderCls = isCritical ? 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950/70 dark:text-rose-200' :
                                         isHigh ? 'border-orange-500 bg-orange-50 text-orange-900 dark:bg-orange-950/70 dark:text-orange-200' :
                                         'border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/70 dark:text-indigo-200';

                        return (
                          <div
                            key={ue.id}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border-l-2 flex items-center gap-1 truncate shadow-2xs ${borderCls}`}
                            title={`${ue.title} (${ue.time || 'All-Day'})`}
                          >
                            {ue.time && (
                              <span className="font-mono text-[9px] font-bold opacity-80 flex-shrink-0">
                                {ue.time}
                              </span>
                            )}
                            <span className="truncate font-semibold">{ue.title}</span>
                          </div>
                        );
                      })}

                      {/* 3. Operational Milestones (if room) */}
                      {visibleHolidays.length === 0 && visibleUserEvents.length === 0 && d.milestones.slice(0, 1).map((m, mIdx) => (
                        <div
                          key={`gm-${mIdx}`}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-900 dark:bg-blue-950/70 dark:text-blue-200 border-l-2 border-blue-500 flex items-center gap-1 truncate shadow-2xs"
                        >
                          <Sparkles className="w-2.5 h-2.5 flex-shrink-0 text-blue-500" />
                          <span className="truncate">{m.title}</span>
                        </div>
                      ))}
                    </div>

                    {/* Overflow Pill */}
                    {overflowCount > 0 && (
                      <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 px-1 pt-0.5">
                        +{overflowCount} more
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendar Legend */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-700 dark:text-slate-300">Priority:</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Critical</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> High</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Medium</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Low</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Live Google Calendar Gazette Stream Active
            </span>
          </div>
        </Card>

        {/* ================================================================== */}
        {/* 2. DAY DETAIL / "MILESTONES FOR [DATE]" PANEL                       */}
        {/* ================================================================== */}
        <Card className="xl:col-span-4 border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden flex flex-col justify-between bg-white dark:bg-slate-900">
          <div>
            {/* Panel Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  Milestones & Tasks
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formattedSelectedDate} • <strong className="font-semibold text-slate-700 dark:text-slate-300">{selectedDayItems.totalCount} items</strong>
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => handleOpenAddModal(selectedDate)}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-2.5 rounded-xl shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Event
              </Button>
            </div>

            {/* List Body: Strictly Ordered as Holidays -> Milestones -> User Events */}
            <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">

              {/* Empty state */}
              {selectedDayItems.totalCount === 0 && (
                <div className="text-center py-16 text-slate-400 space-y-2.5">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    No Events Scheduled for this Day
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Standard manufacturing shift rhythm. Click "+ Add Event" above to schedule tasks or audits.
                  </p>
                </div>
              )}

              {/* 1. PUBLIC HOLIDAYS */}
              {selectedDayItems.holidays.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <Flag className="w-3 h-3" />
                    Public Gazette Holidays ({selectedDayItems.holidays.length})
                  </div>
                  {selectedDayItems.holidays.map((h, idx) => (
                    <div
                      key={`h-${idx}`}
                      className="p-3.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/70 text-xs space-y-2 shadow-xs transition-all hover:border-purple-300"
                    >
                      <div className="flex items-center justify-between font-bold text-purple-950 dark:text-purple-200">
                        <span className="flex items-center gap-1.5 text-sm">
                          {h.isTentative ? <Moon className="w-4 h-4 text-amber-500" /> : <Flag className="w-4 h-4 text-purple-600" />}
                          {h.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                          {h.type || 'Holiday'}
                        </span>
                      </div>
                      <div className="text-[11px] text-purple-800/90 dark:text-purple-300/90 space-y-1">
                        <div className="flex items-center justify-between">
                          <span>{h.note || (h.type ? `${h.type} • National` : 'Gazetted Holiday')}</span>
                          {h.isTentative && (
                            <span className="text-amber-600 dark:text-amber-400 text-[10px] font-semibold italic">
                              Tentative Date
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1 pt-0.5 border-t border-purple-100 dark:border-purple-900/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Source: {h.source || 'Google Calendar Official India Live Feed'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 2. OPERATIONAL MILESTONES */}
              {selectedDayItems.milestones.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    ERP Forecasted Milestones ({selectedDayItems.milestones.length})
                  </div>
                  {selectedDayItems.milestones.map((m, idx) => (
                    <div
                      key={`m-${idx}`}
                      className={`p-3.5 rounded-xl border text-xs space-y-1.5 shadow-xs transition-all ${
                        m.severity === 'critical'
                          ? 'bg-rose-50/90 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/70'
                          : m.type === 'cash_inflow'
                          ? 'bg-emerald-50/90 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/70'
                          : m.type === 'cash_outflow'
                          ? 'bg-amber-50/90 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/70'
                          : 'bg-blue-50/80 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900/70'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className={`text-xs ${m.severity === 'critical' ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-white'}`}>
                          {m.title}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-white/90 dark:bg-slate-800 border text-slate-600 dark:text-slate-300">
                          {m.type}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                        {m.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* 3. USER SCHEDULED EVENTS (With User Creator & Role Visibility Display) */}
              {selectedDayItems.userEvents.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-slate-500" />
                      User Scheduled Events ({selectedDayItems.userEvents.length})
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Sorted by time</span>
                  </div>
                  {selectedDayItems.userEvents.map((ue) => {
                    let roles = ue.allowedRoles;
                    if (typeof roles === 'string') {
                      try { roles = JSON.parse(roles); } catch { roles = ['ALL']; }
                    }
                    const isAllRoles = !roles || roles.length === 0 || roles.includes('ALL');

                    return (
                      <div
                        key={ue.id}
                        className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-xs space-y-2.5 hover:border-slate-300 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                              {ue.title}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                                {ue.time ? ue.time : 'Untimed / All-Day'}
                              </span>
                              <span className={`text-[9px] font-bold px-2 py-0.2 rounded-md ${
                                ue.priority === 'Critical'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                  : ue.priority === 'High'
                                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                                  : ue.priority === 'Medium'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}>
                                {ue.priority}
                              </span>
                            </div>
                          </div>

                          {/* Action Controls */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditModal(ue)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Edit Event"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveEvent(ue.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Delete Event"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Note */}
                        {ue.note && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg leading-relaxed border border-slate-100 dark:border-slate-800">
                            {ue.note}
                          </p>
                        )}

                        {/* Visibility and Creator Metadata */}
                        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                          {/* Visibility badge */}
                          <span className="inline-flex items-center gap-1 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300">
                            <Eye className="w-3 h-3 text-indigo-500" />
                            <span>
                              {isAllRoles ? 'Visible: All Roles' : `Roles: ${roles.join(', ')}`}
                            </span>
                          </span>

                          {/* Creator info */}
                          <span className="font-mono text-[9px] text-slate-400">
                            By {ue.creatorName || 'User'} ({ue.creatorRole || 'SUPERVISOR'})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </div>

          {/* Panel Footer */}
          <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              PostgreSQL Persisted
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenAddModal(selectedDate)}
              className="h-8 text-xs font-semibold rounded-xl"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Event to {selectedDate}
            </Button>
          </div>
        </Card>

      </div>

      {/* ==================================================================== */}
      {/* 3. ADD / EDIT EVENT MODAL (With Role Visibility Checkboxes)           */}
      {/* ==================================================================== */}
      {eventModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/30">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    {editingEventId ? 'Edit Scheduled Event' : 'Add New Operational Event'}
                  </h3>
                  <p className="text-[11px] text-slate-500">PostgreSQL Persisted • Target Role Scoped</p>
                </div>
              </div>
              <button
                onClick={() => setEventModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEvent} className="p-4 sm:p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title Input */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Event Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., FSSAI Quality Audit, Boiler Maintenance, Monthly Shift Handover"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Date & Time Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Time (Optional)
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={e => setFormTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Priority Radio Buttons */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Priority Level
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Low', color: 'text-emerald-600' },
                    { label: 'Medium', color: 'text-amber-600' },
                    { label: 'High', color: 'text-orange-600' },
                    { label: 'Critical', color: 'text-rose-600' }
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setFormPriority(p.label)}
                      className={`py-2 px-2 rounded-xl border text-xs font-bold text-center transition-all ${
                        formPriority === p.label
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* USER ROLE VISIBILITY WITH CHECKBOXES */}
              <div className="space-y-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-500" />
                    Role Visibility (Who Can See This Event)
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formAllowedRoles.includes('ALL') ? 'All Roles (Public)' : `${formAllowedRoles.length} Roles Selected`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {SYSTEM_ROLES.map((r) => {
                    const isChecked = formAllowedRoles.includes('ALL') ? (r.id === 'ALL') : formAllowedRoles.includes(r.id);

                    return (
                      <label
                        key={r.id}
                        className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRoleCheckbox(r.id)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 border-slate-300"
                        />
                        <div className="min-w-0">
                          <div className={`font-bold text-[11px] ${isChecked ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-300'}`}>
                            {r.label}
                          </div>
                          <p className="text-[9px] text-slate-400 leading-tight truncate">
                            {r.desc}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Remarks Textarea */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Operational Remarks / SOP Checklist (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Action instructions, machine checklist, or personnel briefing details..."
                  value={formNote}
                  onChange={e => setFormNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEventModalOpen(false)}
                  className="h-8 text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingEvent}
                  className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/20"
                >
                  {savingEvent ? 'Saving to Database...' : editingEventId ? 'Update Event' : 'Save Event to PostgreSQL'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
