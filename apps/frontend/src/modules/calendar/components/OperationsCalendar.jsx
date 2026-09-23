import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Search, Plus, X, Clock, CheckCircle2, AlertTriangle,
  RotateCcw, Sliders, Layers, Users, Factory, Truck, Check, Trash2,
  Maximize2, Minimize2, PanelLeftClose, PanelLeft, Landmark, RefreshCw,
  Download, AlertOctagon, GitBranch, Play, ShieldAlert, Sparkles,
  ArrowRight, ShieldCheck, Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/axios';

// ============================================================================
// 1. MODULE & STATUS CONFIGURATION (4 ERP PILLARS)
// ============================================================================
export const ERP_MODULES = {
  resource: {
    id: 'resource',
    name: 'Resource Scheduling',
    color: '#2563eb',
    bgColor: 'rgba(37, 99, 235, 0.08)',
    borderColor: 'rgba(37, 99, 235, 0.3)',
    fields: [
      { key: 'resourceId', label: 'Resource ID', type: 'text', placeholder: 'e.g. MCH-014 / EMP-2210', mono: true, required: true },
      { key: 'resourceType', label: 'Resource Type', type: 'select', options: ['Human', 'Machine'], required: true },
      { key: 'capacityLimit', label: 'Capacity Limit', type: 'text', placeholder: 'e.g. 8 units / 480 mins', required: true },
      { key: 'workingHours', label: 'Working Hours', type: 'text', placeholder: 'e.g. 06:00–14:00', required: true },
      { key: 'shiftException', label: 'Shift Exception', type: 'text', placeholder: 'e.g. Overtime approved (+2.5h)', required: false }
    ]
  },
  production: {
    id: 'production',
    name: 'Production Plan',
    color: '#d97706',
    bgColor: 'rgba(217, 119, 6, 0.08)',
    borderColor: 'rgba(217, 119, 6, 0.3)',
    fields: [
      { key: 'workOrderNo', label: 'Work Order #', type: 'text', placeholder: 'e.g. WO-88231', mono: true, required: true },
      { key: 'routingStage', label: 'Routing Stage', type: 'select', options: ['Cutting', 'Machining', 'Assembly', 'Quality Check', 'Packing', 'Dispatch', 'General'], required: true },
      { key: 'setupTimeMinutes', label: 'Setup Time (minutes)', type: 'number', placeholder: '45', required: true },
      { key: 'runTimeMinutes', label: 'Run Time (minutes)', type: 'number', placeholder: '180', required: true },
      { key: 'downtimeBlock', label: 'Down-Time Block', type: 'text', placeholder: 'Reason or "none"', required: false }
    ]
  },
  project: {
    id: 'project',
    name: 'Project Management',
    color: '#7c3aed',
    bgColor: 'rgba(124, 58, 237, 0.08)',
    borderColor: 'rgba(124, 58, 237, 0.3)',
    fields: [
      { key: 'taskName', label: 'Task Name', type: 'text', placeholder: 'e.g. Line 2 Safety Certification', required: true },
      { key: 'taskDependency', label: 'Task Dependency (Linked Work Order or Task)', type: 'text', placeholder: 'e.g. WO-88231 / MCH-014', required: false },
      { key: 'milestone', label: 'Milestone', type: 'select', options: ['No', 'Yes'], required: true },
      { key: 'assignedTeam', label: 'Assigned Team / Resource', type: 'text', placeholder: 'e.g. Engineering QA Squad', required: true }
    ]
  },
  supply: {
    id: 'supply',
    name: 'Supply Chain / Logistics',
    color: '#059669',
    bgColor: 'rgba(5, 150, 105, 0.08)',
    borderColor: 'rgba(5, 150, 105, 0.3)',
    fields: [
      { key: 'referenceNo', label: 'PO / SO Reference', type: 'text', placeholder: 'e.g. PO-44092 / SO-11823', mono: true, required: true },
      { key: 'movementType', label: 'Movement Type', type: 'select', options: ['PO ETA (Inbound)', 'SO Shipping Window', 'Carrier Pickup', 'Dock Allocation', 'Logistics'], required: true },
      { key: 'carrier', label: 'Carrier', type: 'text', placeholder: 'e.g. APL Logistics / BlueDart', required: true },
      { key: 'dockLocation', label: 'Dock / Location', type: 'text', placeholder: 'e.g. Bay-04 / North Yard', required: true }
    ]
  }
};

export const EVENT_STATUSES = {
  Scheduled: { label: 'Scheduled', color: '#64748b', dot: '#64748b' },
  'In Progress': { label: 'In Progress', color: '#2563eb', dot: '#2563eb' },
  Unassigned: { label: 'Unassigned', color: '#d97706', dot: '#d97706' },
  Delayed: { label: 'Delayed', color: '#dc2626', dot: '#dc2626' },
  Completed: { label: 'Completed', color: '#16a34a', dot: '#16a34a' }
};

const formatISODate = (d) => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const ensureISODate = (d) => {
  if (!d) return formatISODate(new Date());
  if (typeof d === 'string') {
    if (d.includes('T')) return d.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) return formatISODate(parsed);
  }
  if (d instanceof Date && !isNaN(d.getTime())) return formatISODate(d);
  return formatISODate(new Date());
};

export default function OperationsCalendar({ operationalMilestones = [], fullScreen = true }) {
  const calendarContainerRef = useRef(null);
  const [isNativeFullScreen, setIsNativeFullScreen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);

  // Fullscreen state listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsNativeFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleNativeFullScreen = () => {
    if (!document.fullscreenElement) {
      if (calendarContainerRef.current?.requestFullscreen) {
        calendarContainerRef.current.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Navigation & View State
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [activeView, setActiveView] = useState('month'); // 'month' | 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [showHolidays, setShowHolidays] = useState(true);
  const [showBottlenecks, setShowBottlenecks] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeModules, setActiveModules] = useState({
    resource: true,
    production: true,
    project: true,
    supply: true
  });

  // What-If Scenario Sandbox State
  const [isScenarioMode, setIsScenarioMode] = useState(false);
  const [scenarioChanges, setScenarioChanges] = useState([]); // List of staged overrides

  // Real-time Database events & Official Gazette Holidays
  const [events, setEvents] = useState([]);
  const [holidays, setHolidays] = useState([]);

  // Live PostgreSQL Reference Numbers (Purchase Orders, Sales Orders, Work Orders)
  const [liveReferences, setLiveReferences] = useState([]);
  const [livePOs, setLivePOs] = useState([]);
  const [liveSOs, setLiveSOs] = useState([]);
  const [liveWOs, setLiveWOs] = useState([]);

  // Slide-in Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [selectedHoliday, setSelectedHoliday] = useState(null);

  // Day Detail Modal State (Replaces cell scrollbars with + more button popup)
  const [dayDetailModal, setDayDetailModal] = useState(null);

  // Dependency Cascade Dialog State
  const [pendingCascade, setPendingCascade] = useState(null);

  // In-App Popup Confirmation Dialog State (Replaces native window.confirm)
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Conflict Pre-Save Warning State
  const [detectedConflicts, setDetectedConflicts] = useState([]);
  const [overrideConflict, setOverrideConflict] = useState(false);

  const [formData, setFormData] = useState({
    module: 'production',
    title: '',
    date: formatISODate(new Date()),
    time: '',
    status: 'Scheduled',
    priority: 'Medium',
    workOrderNo: '',
    routingStage: '',
    setupTimeMinutes: 45,
    runTimeMinutes: 180,
    downtimeBlock: '',
    resourceId: '',
    resourceType: 'Machine',
    capacityLimit: '',
    workingHours: '',
    shiftException: '',
    taskName: '',
    taskDependency: '',
    milestone: 'No',
    assignedTeam: '',
    referenceNo: '',
    movementType: 'PO ETA (Inbound)',
    carrier: '',
    dockLocation: '',
    note: '',
    isSystemMilestone: false
  });

  // Toasts Notification System
  const [toasts, setToasts] = useState([]);

  const addToast = (title, message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const viewedYear = currentDate.getFullYear();

  // Fetch 100% Real-Time Calendar Data from PostgreSQL Database & Feeds
  const fetchLiveCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const [hRes, eRes, fRes, rRes] = await Promise.allSettled([
        api.get('/forecasting/calendar/holidays', { params: { year: viewedYear } }),
        api.get('/forecasting/calendar/events'),
        api.get('/forecasting/comprehensive', { params: { horizonDays: 120 } }),
        api.get('/forecasting/calendar/po-so-references')
      ]);

      // 1. Live Official Gazette Holidays
      if (hRes.status === 'fulfilled' && hRes.value.data?.holidays) {
        setHolidays(hRes.value.data.holidays);
      }

      // Live References from PostgreSQL
      let availableRefs = [];
      let availablePOs = [];
      let availableSOs = [];
      let availableWOs = [];
      if (rRes.status === 'fulfilled' && rRes.value.data?.references) {
        availableRefs = rRes.value.data.references;
        availablePOs = rRes.value.data.pos || [];
        availableSOs = rRes.value.data.sos || [];
        availableWOs = rRes.value.data.wos || [];
        setLiveReferences(availableRefs);
        setLivePOs(availablePOs);
        setLiveSOs(availableSOs);
        setLiveWOs(availableWOs);
      }

      const liveList = [];

      // 2. Live Database User & Scheduled Events
      if (eRes.status === 'fulfilled' && eRes.value.data?.events) {
        eRes.value.data.events.forEach(ev => {
          liveList.push({
            ...ev,
            id: ev.id,
            title: ev.title,
            date: ensureISODate(ev.date),
            time: ev.time || '',
            priority: ev.priority || 'Medium',
            note: ev.note || '',
            module: ev.module || 'production',
            status: ev.status || 'Scheduled',
            workOrderNo: ev.workOrderNo || '',
            routingStage: ev.routingStage || '',
            setupTimeMinutes: Number(ev.setupTimeMinutes) || 0,
            runTimeMinutes: Number(ev.runTimeMinutes) || 0,
            downtimeBlock: ev.downtimeBlock || '',
            resourceId: ev.resourceId || '',
            resourceType: ev.resourceType || '',
            capacityLimit: ev.capacityLimit || '',
            workingHours: ev.workingHours || '',
            shiftException: ev.shiftException || '',
            taskName: ev.taskName || '',
            taskDependency: ev.taskDependency || '',
            milestone: ev.milestone || 'No',
            assignedTeam: ev.assignedTeam || '',
            referenceNo: ev.referenceNo || '',
            movementType: ev.movementType || '',
            carrier: ev.carrier || '',
            dockLocation: ev.dockLocation || '',
            createdBy: ev.createdBy,
            creatorName: ev.creatorName,
            creatorRole: ev.creatorRole,
            allowedRoles: ev.allowedRoles || ['ALL'],
            isSystemMilestone: false
          });
        });
      }

      // 3. Live Forecast Milestones & Production Batches
      const liveMilestones = fRes.status === 'fulfilled' && fRes.value.data?.calendarMilestones
        ? fRes.value.data.calendarMilestones
        : operationalMilestones;

      if (Array.isArray(liveMilestones)) {
        liveMilestones.forEach((m, idx) => {
          const isoDate = ensureISODate(m.date);
          const mType = (m.type || '').toLowerCase();
          let assignedMod = 'project';
          if (mType === 'po_arrival' || mType === 'procurement' || mType.includes('supply')) assignedMod = 'supply';
          else if (mType === 'batch_complete' || mType === 'stockout' || mType.includes('production')) assignedMod = 'production';
          else if (mType === 'maintenance' || mType.includes('resource')) assignedMod = 'resource';

          // Extract true PO, SO, or Batch reference:
          const desc = m.description || '';
          const poMatch = desc.match(/\(PO:\s*([^,)]+)/i) || desc.match(/for PO\s+([^\s,)]+)/i);
          const soMatch = desc.match(/\(Ref:\s*([^,)]+)/i);
          const batchMatch = desc.match(/Batch Target Complete:\s*([^\s,)]+)/i);

          let realRef = m.ref;
          if (!realRef) {
            if (poMatch) realRef = poMatch[1].trim();
            else if (soMatch) realRef = soMatch[1].trim();
            else if (assignedMod === 'supply') {
              realRef = availablePOs[idx % Math.max(1, availablePOs.length)] || (availableRefs[0]?.referenceNo || 'PO-000004');
            } else if (assignedMod === 'production') {
              realRef = availableWOs[idx % Math.max(1, availableWOs.length)] || 'MP-000001';
            } else {
              realRef = availableRefs[idx % Math.max(1, availableRefs.length)]?.referenceNo || 'CO-000001';
            }
          }

          let realWo = m.workOrderNo;
          if (!realWo) {
            if (assignedMod === 'production') {
              realWo = (batchMatch && batchMatch[1]) ? batchMatch[1].trim() : (availableWOs[idx % Math.max(1, availableWOs.length)] || 'MP-000001');
            } else {
              realWo = realRef || (availableWOs[0] || 'MP-000001');
            }
          }

          liveList.push({
            id: `live-ms-${idx}-${isoDate}`,
            title: m.name || m.title || 'Operational Milestone',
            date: isoDate,
            time: '09:00',
            module: assignedMod,
            status: m.status || 'Scheduled',
            priority: m.severity === 'critical' ? 'High' : 'Medium',
            isSystemMilestone: true,
            milestone: 'Yes',
            referenceNo: realRef,
            workOrderNo: realWo,
            routingStage: assignedMod === 'production' ? 'Assembly' : 'General',
            setupTimeMinutes: 45,
            runTimeMinutes: 180,
            downtimeBlock: 'none',
            movementType: assignedMod === 'supply' ? 'PO ETA (Inbound)' : 'Dock Allocation',
            taskName: m.title || 'Operational Task',
            note: m.description || 'Live ERP planning milestone generated from operational schedules.'
          });
        });
      }

      setEvents(liveList);
    } catch (err) {
      console.error('Failed to fetch real-time calendar data:', err);
      addToast('Sync Error', 'Could not refresh operational records from database', 'error');
    } finally {
      setLoading(false);
    }
  }, [viewedYear, operationalMilestones]);

  useEffect(() => {
    fetchLiveCalendarData();
  }, [fetchLiveCalendarData]);

  // Combined Active Events: Staged Scenario or Live Database Events
  const displayedEvents = useMemo(() => {
    if (!isScenarioMode || scenarioChanges.length === 0) return events;
    const map = new Map(events.map(e => [e.id, { ...e }]));
    scenarioChanges.forEach(sc => {
      if (map.has(sc.id)) {
        map.set(sc.id, { ...map.get(sc.id), ...sc });
      } else {
        map.set(sc.id, sc);
      }
    });
    return Array.from(map.values());
  }, [events, isScenarioMode, scenarioChanges]);

  // Conflict Pre-Check Watcher (Runs instantaneously on client against live state and database)
  const runConflictCheck = useCallback((currentData, eventId) => {
    if (!currentData.date) return;
    const conflicts = [];
    const proposedMins = (Number(currentData.setupTimeMinutes) || 0) + (Number(currentData.runTimeMinutes) || 0);

    // 1. Check Resource Capacity (480 mins max shift or double-booking)
    if (currentData.resourceId && currentData.resourceId.trim()) {
      const resId = currentData.resourceId.trim().toLowerCase();
      const existing = displayedEvents.filter(e => {
        if (e.id === eventId) return false;
        return e.date === currentData.date && e.resourceId && e.resourceId.trim().toLowerCase() === resId;
      });

      let totalMins = proposedMins;
      existing.forEach(e => {
        totalMins += (Number(e.setupTimeMinutes) || 0) + (Number(e.runTimeMinutes) || 0);
      });

      const shiftLimit = 480; // Standard 8h operational shift
      if (totalMins > shiftLimit) {
        conflicts.push({
          type: 'OVER_ALLOCATION',
          resourceId: currentData.resourceId,
          totalMinutes: totalMins,
          capacityLimitMinutes: shiftLimit,
          message: `Resource "${currentData.resourceId}" would exceed standard 8h shift capacity (${totalMins}m scheduled vs 480m limit) on ${currentData.date}.`
        });
      } else if (existing.length > 0) {
        conflicts.push({
          type: 'RESOURCE_CO_BOOKED',
          resourceId: currentData.resourceId,
          totalMinutes: totalMins,
          message: `Resource "${currentData.resourceId}" already has ${existing.length} job(s) (${existing.map(j => j.title).join(', ')}) scheduled on ${currentData.date}.`
        });
      }
    }

    // 2. Check Routing Stage Bottleneck (> 720 min queue load)
    if (currentData.routingStage && currentData.routingStage !== 'General') {
      const stageEvents = displayedEvents.filter(e => {
        if (e.id === eventId) return false;
        return e.date === currentData.date && e.routingStage === currentData.routingStage;
      });

      let stageMins = proposedMins;
      stageEvents.forEach(e => {
        stageMins += (Number(e.setupTimeMinutes) || 0) + (Number(e.runTimeMinutes) || 0);
      });

      if (stageMins > 720) {
        conflicts.push({
          type: 'STAGE_BOTTLENECK',
          routingStage: currentData.routingStage,
          message: `Work Center queue for "${currentData.routingStage}" is bottlenecked (${stageMins} mins scheduled across ${stageEvents.length + 1} operations) on ${currentData.date}.`
        });
      }
    }

    setDetectedConflicts(conflicts);
  }, [displayedEvents]);

  // Open Drawer for Add, View, or Edit
  const openDrawer = (eventId = null, presetDate = null) => {
    setDetectedConflicts([]);
    setOverrideConflict(false);

    if (eventId) {
      const existing = displayedEvents.find(e => e.id === eventId);
      if (existing) {
        setEditingEventId(eventId);
        const data = {
          module: existing.module || 'production',
          title: existing.title || '',
          date: ensureISODate(existing.date),
          time: existing.time || '09:00',
          status: existing.status || 'Scheduled',
          priority: existing.priority || 'Medium',
          workOrderNo: existing.workOrderNo || '',
          routingStage: existing.routingStage || 'General',
          setupTimeMinutes: existing.setupTimeMinutes ?? 45,
          runTimeMinutes: existing.runTimeMinutes ?? 180,
          downtimeBlock: existing.downtimeBlock || '',
          resourceId: existing.resourceId || '',
          resourceType: existing.resourceType || 'Machine',
          capacityLimit: existing.capacityLimit || '',
          workingHours: existing.workingHours || '',
          shiftException: existing.shiftException || '',
          taskName: existing.taskName || existing.title || '',
          taskDependency: existing.taskDependency || '',
          milestone: existing.milestone || (existing.isSystemMilestone ? 'Yes' : 'No'),
          assignedTeam: existing.assignedTeam || '',
          referenceNo: existing.referenceNo || '',
          movementType: existing.movementType || 'PO ETA (Inbound)',
          carrier: existing.carrier || '',
          dockLocation: existing.dockLocation || '',
          note: existing.note || (existing.isSystemMilestone ? 'Live ERP generated milestone from operational scheduling.' : ''),
          isSystemMilestone: !!existing.isSystemMilestone
        };
        setFormData(data);
        setDrawerOpen(true);
        runConflictCheck(data, eventId);
        return;
      }
    }

    // Default New Event
    setEditingEventId(null);
    const initialNew = {
      module: 'production',
      title: '',
      date: presetDate ? ensureISODate(presetDate) : formatISODate(new Date()),
      time: '09:00',
      status: 'Scheduled',
      priority: 'Medium',
      workOrderNo: '',
      routingStage: 'Assembly',
      setupTimeMinutes: 45,
      runTimeMinutes: 180,
      downtimeBlock: '',
      resourceId: '',
      resourceType: 'Machine',
      capacityLimit: '480 mins',
      workingHours: '08:00–17:00',
      shiftException: '',
      taskName: '',
      taskDependency: '',
      milestone: 'No',
      assignedTeam: '',
      referenceNo: '',
      movementType: 'PO ETA (Inbound)',
      carrier: '',
      dockLocation: '',
      note: '',
      isSystemMilestone: false
    };
    setFormData(initialNew);
    setDrawerOpen(true);
    runConflictCheck(initialNew, null);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingEventId(null);
    setDetectedConflicts([]);
    setOverrideConflict(false);
  };

  // Drag and Drop State
  const [draggedEventId, setDraggedEventId] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);

  // Trigger Dependency Cascade or Direct Rescheduling on Drop
  const handleDropOnDate = async (targetDate) => {
    if (!draggedEventId) return;
    const target = displayedEvents.find(e => e.id === draggedEventId);
    if (!target || target.date === targetDate) {
      setDraggedEventId(null);
      setDragOverDate(null);
      return;
    }

    // Check if there are downstream dependent operations linked
    const wo = target.workOrderNo;
    const tName = target.taskName || target.title;
    const dependents = displayedEvents.filter(e => {
      if (e.id === target.id) return false;
      const matchDep = e.taskDependency && (e.taskDependency.includes(wo) || e.taskDependency.includes(tName));
      const matchWo = wo && e.workOrderNo === wo && e.date >= target.date;
      return matchDep || matchWo;
    });

    if (dependents.length > 0 && !isScenarioMode) {
      setPendingCascade({
        targetEvent: target,
        newDate: targetDate,
        dependents
      });
      setDraggedEventId(null);
      setDragOverDate(null);
      return;
    }

    // Direct shift (or sandbox shift in Scenario Mode)
    await executeReschedule(target, targetDate, false);
    setDraggedEventId(null);
    setDragOverDate(null);
  };

  // Execute Reschedule in Database or Scenario Buffer
  const executeReschedule = async (targetEvent, targetDate, cascadeDownstream) => {
    const oldD = new Date(targetEvent.date + 'T00:00:00');
    const newD = new Date(targetDate + 'T00:00:00');
    const diffDays = Math.round((newD.getTime() - oldD.getTime()) / (1000 * 60 * 60 * 24));

    if (isScenarioMode) {
      // Stage in What-If Sandbox
      const updated = { ...targetEvent, date: targetDate };
      const newStaged = [...scenarioChanges.filter(s => s.id !== targetEvent.id), updated];

      if (cascadeDownstream && pendingCascade) {
        pendingCascade.dependents.forEach(dep => {
          const depOld = new Date(dep.date + 'T00:00:00');
          const depNew = new Date(depOld.getTime() + diffDays * 24 * 60 * 60 * 1000);
          const depIso = depNew.toISOString().split('T')[0];
          newStaged.push({ ...dep, date: depIso });
        });
      }

      setScenarioChanges(newStaged);
      addToast('Scenario Staged', `Simulated shift for "${targetEvent.title}" to ${targetDate}`, 'info');
      setPendingCascade(null);
      return;
    }

    try {
      if (targetEvent.id.startsWith('live-ms-')) {
        await api.post('/forecasting/calendar/events', {
          ...targetEvent,
          date: targetDate
        });
      } else {
        await api.put(`/forecasting/calendar/events/${targetEvent.id}`, {
          ...targetEvent,
          date: targetDate
        });
      }

      if (cascadeDownstream && pendingCascade && pendingCascade.dependents.length > 0) {
        let cascadeCount = 0;
        for (const dep of pendingCascade.dependents) {
          const depOld = new Date(dep.date + 'T00:00:00');
          const depNew = new Date(depOld.getTime() + diffDays * 24 * 60 * 60 * 1000);
          const depIso = depNew.toISOString().split('T')[0];

          if (dep.id.startsWith('live-ms-')) {
            await api.post('/forecasting/calendar/events', { ...dep, date: depIso });
          } else {
            await api.put(`/forecasting/calendar/events/${dep.id}`, { ...dep, date: depIso });
          }
          cascadeCount++;
        }
        addToast('Cascaded Reschedule', `"${targetEvent.title}" + ${cascadeCount} downstream operation(s) shifted by ${diffDays > 0 ? '+' : ''}${diffDays}d`, 'reschedule');
      } else {
        addToast('Rescheduled', `"${targetEvent.title}" moved to ${targetDate}`, 'reschedule');
      }

      setPendingCascade(null);
      await fetchLiveCalendarData();
    } catch (err) {
      console.error('Failed to reschedule:', err);
      addToast('Reschedule Failed', err.response?.data?.message || err.message, 'error');
    }
  };

  // Filtered Events based on active modules and live search
  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return displayedEvents.filter(ev => {
      if (!activeModules[ev.module]) return false;
      if (q) {
        const inTitle = (ev.title || '').toLowerCase().includes(q);
        const inStatus = (ev.status || '').toLowerCase().includes(q);
        const inFields = Object.keys(ev).some(k => {
          if (k === 'id' || k === 'module') return false;
          return String(ev[k] || '').toLowerCase().includes(q);
        });
        if (!inTitle && !inStatus && !inFields) return false;
      }
      return true;
    });
  }, [displayedEvents, activeModules, searchQuery]);

  // Bottlenecks & Machine Over-Allocation Computation Per Day
  const dailyWorkload = useMemo(() => {
    const stats = {};
    displayedEvents.forEach(ev => {
      const d = ensureISODate(ev.date);
      if (!stats[d]) {
        stats[d] = {
          totalMinutes: 0,
          jobCount: 0,
          stages: {},
          resources: {}
        };
      }
      const mins = (Number(ev.setupTimeMinutes) || 0) + (Number(ev.runTimeMinutes) || 0);
      stats[d].totalMinutes += mins;
      stats[d].jobCount++;

      if (ev.routingStage) {
        stats[d].stages[ev.routingStage] = (stats[d].stages[ev.routingStage] || 0) + mins;
      }
      if (ev.resourceId) {
        stats[d].resources[ev.resourceId] = (stats[d].resources[ev.resourceId] || 0) + mins;
      }
    });
    return stats;
  }, [displayedEvents]);

  // Save or Update Event
  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!formData.title.trim() || !formData.date) {
      addToast('Validation Error', 'Title and date are required', 'error');
      return;
    }

    if (detectedConflicts.length > 0 && !overrideConflict) {
      addToast('Capacity Guardrail', 'Please acknowledge resource capacity warning before saving', 'error');
      return;
    }

    const {
      module, title, date, time, priority, status,
      workOrderNo, routingStage, setupTimeMinutes, runTimeMinutes, downtimeBlock,
      resourceId, resourceType, capacityLimit, workingHours, shiftException,
      taskName, taskDependency, milestone, assignedTeam,
      referenceNo, movementType, carrier, dockLocation, note
    } = formData;

    const payload = {
      id: editingEventId || `ue-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: title.trim(),
      date: ensureISODate(date),
      time: time || null,
      priority: priority || (status === 'Delayed' ? 'High' : 'Medium'),
      note: note || '',
      module: module || 'production',
      status: status || 'Scheduled',
      workOrderNo: workOrderNo || null,
      routingStage: routingStage || null,
      setupTimeMinutes: Number(setupTimeMinutes) || 0,
      runTimeMinutes: Number(runTimeMinutes) || 0,
      downtimeBlock: downtimeBlock || null,
      resourceId: resourceId || null,
      resourceType: resourceType || null,
      capacityLimit: capacityLimit || null,
      workingHours: workingHours || null,
      shiftException: shiftException || null,
      taskName: taskName || null,
      taskDependency: taskDependency || null,
      milestone: milestone || 'No',
      assignedTeam: assignedTeam || null,
      referenceNo: referenceNo || null,
      movementType: movementType || null,
      carrier: carrier || null,
      dockLocation: dockLocation || null,
      allowedRoles: ['ALL']
    };

    if (isScenarioMode) {
      setScenarioChanges(prev => [...prev.filter(s => s.id !== payload.id), payload]);
      addToast('Scenario Updated', `Staged changes for "${title}" in What-If sandbox`, 'info');
      closeDrawer();
      return;
    }

    try {
      if (editingEventId && !editingEventId.startsWith('live-ms-')) {
        await api.put(`/forecasting/calendar/events/${editingEventId}`, payload);
        addToast('Saved', `"${title}" updated successfully`, 'success');
      } else {
        await api.post('/forecasting/calendar/events', payload);
        addToast('Created', `"${title}" added to operational schedule`, 'success');
      }
      closeDrawer();
      await fetchLiveCalendarData();
    } catch (err) {
      console.error('Failed to save event:', err);
      addToast('Save Failed', err.response?.data?.message || err.message, 'error');
    }
  };

  // Delete Event with In-App Popup Dialog
  const handleDelete = () => {
    if (!editingEventId) return;
    const target = displayedEvents.find(e => e.id === editingEventId);
    const title = target ? target.title : 'Record';

    if (isScenarioMode) {
      setConfirmDialog({
        title: 'Remove Simulated Event?',
        message: `Remove "${title}" from the active scenario sandbox?`,
        confirmText: 'Remove',
        cancelText: 'Cancel',
        type: 'danger',
        onConfirm: () => {
          setScenarioChanges(prev => prev.filter(s => s.id !== editingEventId));
          addToast('Simulation Removed', `"${title}" removed from scenario`, 'info');
          closeDrawer();
          setConfirmDialog(null);
        }
      });
      return;
    }

    if (editingEventId.startsWith('live-ms-')) {
      setConfirmDialog({
        title: 'Hide Operational Milestone?',
        message: `Hide milestone "${title}" from your calendar view?`,
        confirmText: 'Hide Milestone',
        cancelText: 'Cancel',
        type: 'warning',
        onConfirm: () => {
          setEvents(prev => prev.filter(e => e.id !== editingEventId));
          addToast('Removed', `"${title}" removed from view`, 'delete');
          closeDrawer();
          setConfirmDialog(null);
        }
      });
      return;
    }

    setConfirmDialog({
      title: 'Delete Operational Event?',
      message: `Are you sure you want to permanently delete "${title}" from the operational database? This action cannot be undone.`,
      confirmText: 'Delete Event',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.delete(`/forecasting/calendar/events/${editingEventId}`);
          addToast('Deleted', `"${title}" deleted successfully`, 'delete');
          closeDrawer();
          await fetchLiveCalendarData();
        } catch (err) {
          console.error('Failed to delete live event:', err);
          addToast('Delete Failed', err.response?.data?.message || err.message, 'error');
        }
      }
    });
  };

  // Commit Staged Scenario with In-App Popup Dialog
  const commitScenarioToDatabase = () => {
    if (scenarioChanges.length === 0) {
      addToast('Empty Scenario', 'No simulated changes to commit', 'info');
      return;
    }

    setConfirmDialog({
      title: 'Commit Scenario to Live Database?',
      message: `Apply and commit ${scenarioChanges.length} scenario change(s) directly to the operational database? This will update the live plant schedule for all teams.`,
      confirmText: 'Commit to Database',
      cancelText: 'Keep Editing',
      type: 'primary',
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);
        try {
          for (const ev of scenarioChanges) {
            if (ev.id.startsWith('live-ms-') || !events.some(e => e.id === ev.id)) {
              await api.post('/forecasting/calendar/events', ev);
            } else {
              await api.put(`/forecasting/calendar/events/${ev.id}`, ev);
            }
          }
          addToast('Scenario Committed', `${scenarioChanges.length} scenario modification(s) written to database`, 'success');
          setScenarioChanges([]);
          setIsScenarioMode(false);
          await fetchLiveCalendarData();
        } catch (err) {
          console.error('Failed to commit scenario:', err);
          addToast('Commit Failed', err.response?.data?.message || err.message, 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Discard Scenario with In-App Popup Dialog
  const discardScenario = () => {
    if (scenarioChanges.length === 0) {
      setIsScenarioMode(false);
      return;
    }

    setConfirmDialog({
      title: 'Discard Scenario Sandbox?',
      message: 'Discard all staged simulation adjustments and revert to the live operational schedule? Staged changes will not be saved.',
      confirmText: 'Discard Changes',
      cancelText: 'Keep Simulating',
      type: 'danger',
      onConfirm: () => {
        setScenarioChanges([]);
        setIsScenarioMode(false);
        setConfirmDialog(null);
        addToast('Simulation Discarded', 'Reverted to live schedule', 'info');
      }
    });
  };

  // Export RFC 5545 iCalendar (.ics)
  const exportICalendar = () => {
    try {
      let ics = 'BEGIN:VCALENDAR\r\n';
      ics += 'VERSION:2.0\r\n';
      ics += 'PRODID:-//Manufacturing ERP//Operations Calendar//EN\r\n';
      ics += 'CALSCALE:GREGORIAN\r\n';
      ics += 'METHOD:PUBLISH\r\n';
      ics += 'X-WR-CALNAME:ERP Operations Schedule\r\n';

      const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

      displayedEvents.forEach(ev => {
        const cleanDate = (ev.date || '').replace(/-/g, '');
        const uid = (ev.id || 'evt') + '@erp.operations';
        const summary = (ev.title || 'ERP Event').replace(/[\\;,]/g, ' ');
        const desc = `Module: ${ev.module || 'Operations'}\\nStatus: ${ev.status || 'Scheduled'}\\nWork Order: ${ev.workOrderNo || 'N/A'}\\nStage: ${ev.routingStage || 'N/A'}\\nNotes: ${(ev.note || '').replace(/\n/g, ' ')}`;

        ics += 'BEGIN:VEVENT\r\n';
        ics += `UID:${uid}\r\n`;
        ics += `DTSTAMP:${nowStr}\r\n`;
        ics += `DTSTART;VALUE=DATE:${cleanDate}\r\n`;
        ics += `DTEND;VALUE=DATE:${cleanDate}\r\n`;
        ics += `SUMMARY:${summary}\r\n`;
        ics += `DESCRIPTION:${desc}\r\n`;
        ics += `STATUS:CONFIRMED\r\n`;
        ics += 'END:VEVENT\r\n';
      });

      ics += 'END:VCALENDAR\r\n';

      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `erp-operations-schedule-${formatISODate(new Date())}.ics`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      addToast('Export Complete', 'iCalendar file downloaded successfully', 'success');
    } catch (err) {
      console.error('ICS Export Failed:', err);
      addToast('Export Failed', 'Could not generate calendar export file', 'error');
    }
  };


  // Month grid dates calculation with live events and live holidays
  const monthGridData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const todayISO = formatISODate(new Date());

    const eventsByDate = {};
    filteredEvents.forEach(ev => {
      const d = ensureISODate(ev.date);
      if (!eventsByDate[d]) eventsByDate[d] = [];
      eventsByDate[d].push(ev);
    });

    const holidaysByDate = {};
    if (showHolidays) {
      holidays.forEach(h => {
        const d = ensureISODate(h.date);
        if (!holidaysByDate[d]) holidaysByDate[d] = [];
        holidaysByDate[d].push(h);
      });
    }

    const cells = [];
    let dayCount = 1;
    let nextCount = 1;

    for (let i = 0; i < 42; i++) {
      if (i < firstDayIndex) {
        const prevD = daysInPrevMonth - (firstDayIndex - i - 1);
        const iso = formatISODate(new Date(year, month - 1, prevD));
        cells.push({
          dateStr: iso,
          dayNumber: prevD,
          isCurrentMonth: false,
          isToday: iso === todayISO,
          events: eventsByDate[iso] || [],
          holidays: holidaysByDate[iso] || [],
          workload: dailyWorkload[iso] || null
        });
      } else if (dayCount <= daysInMonth) {
        const iso = formatISODate(new Date(year, month, dayCount));
        cells.push({
          dateStr: iso,
          dayNumber: dayCount,
          isCurrentMonth: true,
          isToday: iso === todayISO,
          events: eventsByDate[iso] || [],
          holidays: holidaysByDate[iso] || [],
          workload: dailyWorkload[iso] || null
        });
        dayCount++;
      } else {
        const iso = formatISODate(new Date(year, month + 1, nextCount));
        cells.push({
          dateStr: iso,
          dayNumber: nextCount,
          isCurrentMonth: false,
          isToday: iso === todayISO,
          events: eventsByDate[iso] || [],
          holidays: holidaysByDate[iso] || [],
          workload: dailyWorkload[iso] || null
        });
        nextCount++;
      }
    }
    return cells;
  }, [currentDate, filteredEvents, holidays, showHolidays, dailyWorkload]);

  return (
    <div 
      ref={calendarContainerRef}
      className={`flex flex-col w-full h-full flex-1 bg-[#f4f5f8] dark:bg-[#0f1318] text-[#111827] dark:text-[#f3f4f6] font-sans overflow-hidden ${
        fullScreen || isNativeFullScreen
          ? 'rounded-none border-0 shadow-none m-0 p-0 h-full min-h-0'
          : 'rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-[calc(100vh-5rem)]'
      }`}
    >
      
      {/* 1. WHAT-IF SCENARIO BANNER (IF ACTIVE) */}
      {isScenarioMode && (
        <div className="bg-purple-900 text-white px-4 py-2 flex items-center justify-between text-xs font-semibold shrink-0 shadow-sm animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-purple-800 text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <span>
              <strong>What-If Scenario Sandbox Active</strong>: Staging changes locally without affecting live production operations.
            </span>
            <span className="px-2 py-0.5 rounded-full bg-purple-800 text-purple-200 font-mono text-[10px]">
              {scenarioChanges.length} staged adjustment{scenarioChanges.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={discardScenario}
              className="px-2.5 py-1 rounded bg-purple-950/60 hover:bg-purple-950 text-purple-200 hover:text-white transition"
            >
              Discard Simulation
            </button>
            <Button
              onClick={commitScenarioToDatabase}
              size="sm"
              className="h-7 px-3 rounded bg-amber-400 hover:bg-amber-300 text-purple-950 font-bold text-xs shadow-xs"
            >
              Commit Scenario to Database
            </Button>
          </div>
        </div>
      )}

      {/* 2. TOP BAR */}
      <header className="h-14 md:h-16 bg-white dark:bg-[#171d24] border-b border-slate-200 dark:border-slate-800 px-3 md:px-6 flex items-center justify-between gap-3 z-10 shrink-0">
        
        {/* Brand & Period Nav */}
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => setRailOpen(r => !r)}
            className="hidden md:flex p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            title={railOpen ? 'Collapse filter sidebar' : 'Expand filter sidebar'}
          >
            {railOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-xs">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-sm md:text-base tracking-tight font-display flex items-center gap-2">
                <span>Operations Calendar</span>
                <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  isScenarioMode 
                    ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/50'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isScenarioMode ? 'bg-purple-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                  {isScenarioMode ? 'Scenario Sandbox' : 'Live Schedule Active'}
                </span>
              </h1>
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-semibold uppercase hidden sm:inline">
                4-Module ERP • Machine & Work Center Intelligence
              </span>
            </div>
          </div>

          {/* Month Steppers */}
          <div className="flex items-center bg-slate-100 dark:bg-[#1f2732] p-1 rounded-lg border border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-2.5 h-7 text-xs font-semibold rounded text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="hidden sm:block text-base font-bold tracking-tight min-w-[140px]">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* View Switcher, Search, Scenario Mode & Export Actions */}
        <div className="flex items-center gap-2 md:gap-2.5">
          
          {/* Scenario Sandbox Mode Toggle */}
          <button
            onClick={() => {
              if (!isScenarioMode) {
                setIsScenarioMode(true);
                addToast('What-If Sandbox', 'Now running in simulation mode. Test schedule ripple effects safely.', 'info');
              } else if (scenarioChanges.length === 0) {
                setIsScenarioMode(false);
              } else {
                discardScenario();
              }
            }}
            className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
              isScenarioMode
                ? 'bg-purple-100 dark:bg-purple-950/60 border-purple-400 text-purple-800 dark:text-purple-300 shadow-xs'
                : 'bg-slate-100 dark:bg-[#1f2732] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
            title="Toggle What-If Scenario Sandbox"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>{isScenarioMode ? 'Exit Scenario' : 'What-If Mode'}</span>
          </button>

          {/* View Switcher */}
          <div className="flex bg-slate-100 dark:bg-[#1f2732] p-1 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs font-semibold">
            <button
              onClick={() => setActiveView('month')}
              className={`px-3 py-1 rounded transition ${activeView === 'month' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Month
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={`px-3 py-1 rounded transition ${activeView === 'list' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Agenda
            </button>
          </div>

          {/* Live Search */}
          <div className="relative hidden lg:block w-40 xl:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search schedule..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-[#1f2732] border border-slate-200 dark:border-slate-700/60 rounded-lg outline-none focus:border-indigo-500 transition"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Export iCal .ics */}
          <button
            onClick={exportICalendar}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            title="Export iCalendar (.ics) for Outlook & Google Calendar"
          >
            <Download className="w-4 h-4" />
          </button>


          {/* Live Refresh Button */}
          <button
            onClick={() => fetchLiveCalendarData()}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleNativeFullScreen}
            className="hidden sm:flex p-2 rounded-lg border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            title={isNativeFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isNativeFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* New Event Button */}
          <Button
            onClick={() => openDrawer(null)}
            className="h-8 md:h-9 px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 flex items-center gap-1.5 text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Event</span>
          </Button>
        </div>
      </header>

      {/* 3. MAIN BODY (LEFT RAIL + CALENDAR WORKSPACE) */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* LEFT RAIL: MODULE FILTERS & LEGEND */}
        <aside className={`${railOpen ? 'w-64 border-r' : 'w-0 border-r-0'} transition-all duration-200 bg-white dark:bg-[#171d24] border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden shrink-0 hidden md:flex`}>
          <div className={`w-64 p-4 space-y-5 flex flex-col h-full overflow-y-auto ${railOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-150`}>
            
            {/* ERP Modules Filter */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                <span>ERP Modules</span>
                <span className="text-[10px] text-slate-400">Live Active</span>
              </div>

              <div className="space-y-1">
                {Object.values(ERP_MODULES).map(mod => {
                  const count = displayedEvents.filter(e => e.module === mod.id).length;
                  const active = !!activeModules[mod.id];

                  return (
                    <label
                      key={mod.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition border text-xs font-medium select-none ${
                        active ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/30 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: mod.color }}></span>
                        <span>{mod.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">{count}</span>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={e => setActiveModules(prev => ({ ...prev, [mod.id]: e.target.checked }))}
                          className="rounded accent-indigo-600 cursor-pointer"
                        />
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* LIVE GAZETTE HOLIDAYS TOGGLE */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                <span>Official Holidays</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">Live Feed</span>
              </div>

              <label className="flex items-center justify-between p-2 rounded-lg cursor-pointer transition border text-xs font-medium bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 select-none">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🏛️</span>
                  <span className="text-emerald-800 dark:text-emerald-300 font-semibold">Gazette Holidays</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-emerald-200/70 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold">
                    {holidays.length}
                  </span>
                  <input
                    type="checkbox"
                    checked={showHolidays}
                    onChange={e => setShowHolidays(e.target.checked)}
                    className="rounded accent-emerald-600 cursor-pointer"
                  />
                </div>
              </label>
            </div>

            {/* BOTTLENECK & CAPACITY GUARDRAILS TOGGLE */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                <span>Capacity Guardrails</span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold font-mono">Real-Time</span>
              </div>

              <label className="flex items-center justify-between p-2 rounded-lg cursor-pointer transition border text-xs font-medium bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50 select-none">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  <span className="text-indigo-900 dark:text-indigo-200 font-semibold">Stage Bottlenecks</span>
                </div>
                <input
                  type="checkbox"
                  checked={showBottlenecks}
                  onChange={e => setShowBottlenecks(e.target.checked)}
                  className="rounded accent-indigo-600 cursor-pointer"
                />
              </label>
            </div>

            {/* Status Stripe Legend */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                Status Legend
              </div>
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                {Object.values(EVENT_STATUSES).map(s => (
                  <div key={s.label} className="flex items-center gap-2.5">
                    <span className="w-1.5 h-3.5 rounded-sm" style={{ backgroundColor: s.color }}></span>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Clean Live Status Footer */}
            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Live Active</span>
              </div>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{displayedEvents.length} items</span>
            </div>
          </div>
        </aside>

        {/* CALENDAR WORKSPACE */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-[#0f1318]">
          {activeView === 'month' ? (
            /* Month Calendar Grid */
            <div className="flex-1 flex flex-col overflow-hidden select-none">
              
              {/* Day Headers (Sun - Sat) */}
              <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#171d24] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 shrink-0">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center">{d}</div>
                ))}
              </div>

              {/* 42 Grid Cells */}
              <div className="flex-1 grid grid-cols-7 grid-rows-6 divide-x divide-y divide-slate-200 dark:divide-slate-800/60 overflow-y-auto">
                {monthGridData.map((cell, idx) => {
                  const isHoveredTarget = dragOverDate === cell.dateStr;
                  const load = cell.workload;
                  const isOverload = load && load.totalMinutes > 480;
                  const isHighLoad = load && load.totalMinutes >= 360 && load.totalMinutes <= 480;

                  return (
                    <div
                      key={cell.dateStr + '-' + idx}
                      onDragOver={e => {
                        e.preventDefault();
                        setDragOverDate(cell.dateStr);
                      }}
                      onDragLeave={() => {
                        if (dragOverDate === cell.dateStr) setDragOverDate(null);
                      }}
                      onDrop={e => {
                        e.preventDefault();
                        handleDropOnDate(cell.dateStr);
                      }}
                      onClick={() => {
                        if (cell.holidays.length > 0 || cell.events.length > 0) {
                          setDayDetailModal({
                            dateStr: cell.dateStr,
                            holidays: cell.holidays,
                            events: cell.events,
                            load: load
                          });
                        } else {
                          openDrawer(null, cell.dateStr);
                        }
                      }}
                      className={`min-h-[105px] p-1.5 flex flex-col gap-1 transition-colors relative group cursor-pointer ${
                        cell.isCurrentMonth
                          ? 'bg-white dark:bg-[#12171e]'
                          : 'bg-slate-50/70 dark:bg-[#0d1015]/60 text-slate-400 dark:text-slate-600'
                      } ${cell.isToday ? 'bg-indigo-50/20 dark:bg-indigo-950/20' : ''} ${
                        isHoveredTarget ? 'ring-2 ring-indigo-500 bg-indigo-50/40 dark:bg-indigo-900/30' : ''
                      }`}
                    >
                      {/* Cell Header: Date Number, Available Count Pill, Bottleneck & Add Button */}
                      <div className="flex items-center justify-between pointer-events-auto">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold shrink-0 ${
                              cell.isToday
                                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                                : cell.isCurrentMonth
                                ? 'text-slate-800 dark:text-slate-200'
                                : 'text-slate-400 dark:text-slate-600'
                            }`}
                          >
                            {cell.dayNumber}
                          </span>

                          {/* Available Events Count Number Button */}
                          {(cell.events.length > 0 || cell.holidays.length > 0) && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setDayDetailModal({
                                  dateStr: cell.dateStr,
                                  holidays: cell.holidays,
                                  events: cell.events,
                                  load: load
                                });
                              }}
                              className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-950/80 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 transition cursor-pointer shrink-0"
                              title={`Click to open popup with all ${cell.events.length + cell.holidays.length} scheduled items on ${cell.dateStr}`}
                            >
                              {cell.events.length + cell.holidays.length} available
                            </button>
                          )}

                          {/* Bottleneck indicator */}
                          {showBottlenecks && isOverload && (
                            <span 
                              className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shrink-0"
                              title={`Capacity Bottleneck: ${load.totalMinutes} mins scheduled across ${load.jobCount} operations (Exceeds 480m 8h shift limit)`}
                            >
                              ⚠️ {Math.round(load.totalMinutes / 60)}h
                            </span>
                          )}
                          {showBottlenecks && isHighLoad && (
                            <span 
                              className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0"
                              title={`High Shift Utilization: ${load.totalMinutes} mins scheduled`}
                            >
                              {Math.round(load.totalMinutes / 60)}h
                            </span>
                          )}
                        </div>

                        <button
                          onClick={e => {
                            e.stopPropagation();
                            openDrawer(null, cell.dateStr);
                          }}
                          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition shrink-0"
                          title={`Add event on ${cell.dateStr}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Events & Holidays Container - Strict overflow-hidden, NO scrollbars */}
                      <div className="flex-1 flex flex-col gap-1 overflow-hidden min-h-0">
                        {(() => {
                          const MAX_VISIBLE = 2;
                          const totalItems = cell.holidays.length + cell.events.length;
                          const hasMore = totalItems > MAX_VISIBLE;

                          let visibleHolidays = [];
                          let visibleEvents = [];

                          if (cell.holidays.length > 0) {
                            visibleHolidays = [cell.holidays[0]];
                            const remainingSlots = MAX_VISIBLE - 1;
                            visibleEvents = cell.events.slice(0, remainingSlots);
                          } else {
                            visibleEvents = cell.events.slice(0, MAX_VISIBLE);
                          }

                          const remainingCount = totalItems - (visibleHolidays.length + visibleEvents.length);

                          return (
                            <>
                              {/* Visible Holidays */}
                              {visibleHolidays.map((h, hIdx) => {
                                const isGazetted = h.gazetted || (h.type && h.type.toLowerCase().includes('gazetted')) || (h.note && h.note.toLowerCase().includes('gazetted'));
                                return (
                                  <div
                                    key={`hol-${h.date}-${hIdx}`}
                                    onClick={e => {
                                      e.stopPropagation();
                                      setSelectedHoliday(h);
                                    }}
                                    className={`text-[10.5px] py-1 px-1.5 rounded-md font-semibold border flex items-center gap-1.5 shadow-2xs select-none transition cursor-pointer hover:opacity-85 shrink-0 ${
                                      isGazetted
                                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700/60'
                                        : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700/60'
                                    }`}
                                    title={`Click to view: ${h.name} (${h.type || 'Official Gazette'})`}
                                  >
                                    <span className="text-xs shrink-0">{isGazetted ? '🏛️' : '🌴'}</span>
                                    <span className="truncate flex-1 font-bold">{h.name}</span>
                                    <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-emerald-200/60 dark:bg-emerald-800/60 font-semibold shrink-0">
                                      {isGazetted ? 'Gazette' : 'Holiday'}
                                    </span>
                                  </div>
                                );
                              })}

                              {/* Visible Events */}
                              {visibleEvents.map(ev => {
                                const mod = ERP_MODULES[ev.module] || ERP_MODULES.production;
                                const stat = EVENT_STATUSES[ev.status] || EVENT_STATUSES.Scheduled;
                                let ref = ev.referenceNo || ev.workOrderNo || ev.resourceId || ev.taskName || '';
                                const isStaged = isScenarioMode && scenarioChanges.some(s => s.id === ev.id);

                                return (
                                  <div
                                    key={ev.id}
                                    draggable={true}
                                    onDragStart={e => {
                                      e.stopPropagation();
                                      setDraggedEventId(ev.id);
                                      e.dataTransfer.setData('text/plain', ev.id);
                                    }}
                                    onClick={e => {
                                      e.stopPropagation();
                                      openDrawer(ev.id);
                                    }}
                                    className={`text-[10.5px] py-1 px-1.5 rounded-md font-medium border shadow-2xs flex items-center gap-1.5 cursor-pointer active:cursor-grabbing hover:-translate-y-0.5 transition shrink-0 ${
                                      isStaged ? 'ring-2 ring-purple-500 border-purple-400' : 'border-transparent'
                                    }`}
                                    style={{
                                      backgroundColor: mod.bgColor,
                                      borderColor: isStaged ? '#a855f7' : mod.borderColor,
                                      borderLeftWidth: '3.5px',
                                      borderLeftColor: stat.color
                                    }}
                                    title={`Click to view/edit: ${ev.title} (${ev.status})`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: mod.color }}></span>
                                    {ev.time && (
                                      <span className="text-[9px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1 py-0.2 rounded font-semibold shrink-0">
                                        {ev.time}
                                      </span>
                                    )}
                                    <span className="truncate flex-1 font-semibold text-slate-900 dark:text-white">{ev.title}</span>
                                    {isStaged && <span className="text-[9px] font-mono text-purple-600 dark:text-purple-300 font-bold shrink-0">SIM</span>}
                                    {ref && !isStaged && <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 shrink-0">{ref}</span>}
                                  </div>
                                );
                              })}

                              {/* + More Button / Badge */}
                              {hasMore && (
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setDayDetailModal({
                                      dateStr: cell.dateStr,
                                      holidays: cell.holidays,
                                      events: cell.events,
                                      load: load
                                    });
                                  }}
                                  className="mt-auto w-full text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/90 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900/80 border border-indigo-200/90 dark:border-indigo-800/80 px-2 py-0.5 rounded-md flex items-center justify-between transition cursor-pointer shadow-2xs shrink-0"
                                  title={`Click to open popup with all ${totalItems} scheduled operations on ${cell.dateStr}`}
                                >
                                  <span className="flex items-center gap-1 font-extrabold text-indigo-600 dark:text-indigo-400">
                                    +{remainingCount} more
                                  </span>
                                  <span className="text-[9px] font-semibold opacity-90 text-slate-500 dark:text-slate-400">
                                    View all ({totalItems}) &rarr;
                                  </span>
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* List / Agenda View */
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <div className="max-w-4xl mx-auto space-y-4">
                {filteredEvents.length === 0 && (!showHolidays || holidays.length === 0) ? (
                  <div className="p-12 text-center text-slate-400 bg-white dark:bg-[#171d24] rounded-xl border border-slate-200 dark:border-slate-800">
                    <CalendarIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <div className="font-bold text-sm">No Live Events or Holidays Found</div>
                    <div className="text-xs">Operational records and official gazette holidays are synchronized in real time.</div>
                  </div>
                ) : (
                  (() => {
                    const grouped = {};
                    filteredEvents.forEach(ev => {
                      const d = ensureISODate(ev.date);
                      if (!grouped[d]) grouped[d] = { events: [], holidays: [] };
                      grouped[d].events.push(ev);
                    });

                    if (showHolidays) {
                      holidays.forEach(h => {
                        const d = ensureISODate(h.date);
                        if (!grouped[d]) grouped[d] = { events: [], holidays: [] };
                        grouped[d].holidays.push(h);
                      });
                    }

                    return Object.keys(grouped).sort().map(dStr => {
                      const dateObj = new Date(dStr + 'T00:00:00');
                      const item = grouped[dStr];
                      const totalCount = item.events.length + item.holidays.length;

                      return (
                        <div key={dStr} className="bg-white dark:bg-[#171d24] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold">
                            <span className="font-display font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                              {item.holidays.length > 0 && <span>🏛️</span>}
                              {dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                              {totalCount} item{totalCount > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {/* Holidays */}
                            {item.holidays.map((h, hIdx) => (
                              <div
                                key={`h-${h.date}-${hIdx}`}
                                onClick={() => setSelectedHoliday(h)}
                                className="p-3.5 flex items-center justify-between gap-4 bg-emerald-50/40 dark:bg-emerald-950/20 border-l-4 border-l-emerald-500 cursor-pointer hover:bg-emerald-50/80 transition"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="px-2 py-0.5 rounded text-[11px] font-bold shrink-0 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                                    🏛️ Official Gazette
                                  </span>
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-emerald-900 dark:text-emerald-100 truncate">{h.name}</div>
                                    <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 truncate">
                                      {h.type || 'Government Gazetted'} • Source: {h.source || 'Official Gazette Feed'}
                                    </div>
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 shrink-0 font-mono">
                                  {h.gazetted || h.type === 'National Gazetted' ? 'Gazetted' : 'Holiday'}
                                </span>
                              </div>
                            ))}

                            {/* Events */}
                            {item.events.map(ev => {
                              const mod = ERP_MODULES[ev.module] || ERP_MODULES.production;
                              const stat = EVENT_STATUSES[ev.status] || EVENT_STATUSES.Scheduled;

                              let details = '';
                              if (ev.module === 'resource') details = `ID: ${ev.resourceId || 'N/A'} • Type: ${ev.resourceType || 'Human'} • Limit: ${ev.capacityLimit || 'Standard'}`;
                              else if (ev.module === 'production') details = `WO: ${ev.workOrderNo || 'N/A'} • Stage: ${ev.routingStage || 'General'} • Setup: ${ev.setupTimeMinutes || 0}m • Run: ${ev.runTimeMinutes || 0}m`;
                              else if (ev.module === 'project') details = `Task: ${ev.taskName || 'Milestone'} • Dependency: ${ev.taskDependency || 'None'} • Team: ${ev.assignedTeam || 'General'}`;
                              else if (ev.module === 'supply') details = `Ref: ${ev.referenceNo || 'PO/SO'} • Movement: ${ev.movementType || 'Logistics'} • Dock: ${ev.dockLocation || 'General'}`;

                              return (
                                <div
                                  key={ev.id}
                                  onClick={() => openDrawer(ev.id)}
                                  className="p-3.5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition border-l-4"
                                  style={{ borderLeftColor: stat.color }}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold shrink-0" style={{ backgroundColor: mod.bgColor, color: mod.color }}>
                                      {mod.name}
                                    </span>
                                    {ev.time && (
                                      <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/50 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                                        <Clock className="w-2.5 h-2.5" />
                                        {ev.time}
                                      </span>
                                    )}
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{ev.title}</div>
                                      <div className="text-[11px] font-mono text-slate-500 truncate">{details}</div>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                                    {ev.status}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. SLIDE-IN RIGHT DRAWER FOR VIEWING & EDITING LIVE EVENTS */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={closeDrawer}></div>
          <div className="relative w-full max-w-md bg-white dark:bg-[#171d24] border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-right duration-200">
            
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#1f2732]/40">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ERP_MODULES[formData.module]?.color }}></span>
                <div>
                  <h2 className="font-bold text-sm tracking-tight">
                    {editingEventId ? (formData.isSystemMilestone ? 'ERP Milestone Details' : 'Edit Event Details') : 'New Event'}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-medium">Review and configure operational parameters</p>
                </div>
              </div>
              <button onClick={closeDrawer} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body Form */}
            <form id="drawerForm" onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              
              {/* Conflict Guardrail Alerts */}
              {detectedConflicts.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Resource Conflict & Over-Allocation Guardrail</span>
                  </div>
                  {detectedConflicts.map((c, cIdx) => (
                    <div key={cIdx} className="text-[11px] text-rose-600 dark:text-rose-400 leading-tight">
                      • {c.message}
                    </div>
                  ))}
                  <label className="flex items-center gap-2 pt-1.5 border-t border-rose-200/60 dark:border-rose-800/60 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={overrideConflict}
                      onChange={e => setOverrideConflict(e.target.checked)}
                      className="rounded accent-rose-600"
                    />
                    <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-200">
                      Supervisor / Planner Override Approved
                    </span>
                  </label>
                </div>
              )}

              {/* System Milestone Notice if applicable */}
              {formData.isSystemMilestone && (
                <div className="p-2.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-semibold">
                    <span>⚡</span>
                    <span>Live ERP Calculated Milestone</span>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded font-bold">
                    Active
                  </span>
                </div>
              )}

              {/* Module Picker */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">ERP Source Module</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(ERP_MODULES).map(mod => {
                    const isSelected = formData.module === mod.id;
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => {
                          const updated = { ...formData, module: mod.id };
                          setFormData(updated);
                          runConflictCheck(updated, editingEventId);
                        }}
                        className={`p-2 rounded-lg border text-left flex items-center gap-2 font-semibold transition ${
                          isSelected ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: mod.color }}></span>
                        <span>{mod.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shared Core Fields */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-300">Title / Event Description *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. CNC Mill A Precision Machining"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-300">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => {
                      const updated = { ...formData, date: e.target.value };
                      setFormData(updated);
                      runConflictCheck(updated, editingEventId);
                    }}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 font-mono text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>Time</span>
                  </label>
                  <input
                    type="time"
                    value={formData.time || ''}
                    onChange={e => {
                      const updated = { ...formData, time: e.target.value };
                      setFormData(updated);
                      runConflictCheck(updated, editingEventId);
                    }}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 font-mono text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-300">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-xs text-slate-900 dark:text-white"
                  >
                    {Object.keys(EVENT_STATUSES).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Module Specific Fields */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="font-bold text-[11px] uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>{ERP_MODULES[formData.module]?.name} Fields</span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">Relational ERP Layer</span>
                </div>

                {ERP_MODULES[formData.module]?.fields.map(f => (
                  <div key={f.key} className="space-y-1">
                    <label className="font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                      <span>{f.label} {f.required && '*'}</span>
                      {f.mono && <span className="text-[10px] text-slate-400 font-mono">ERP-ID</span>}
                    </label>

                    {f.key === 'referenceNo' ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            type="text"
                            list="live-po-so-datalist"
                            placeholder="Type or select live PO # (e.g. PO-000004)"
                            value={formData.referenceNo || ''}
                            onChange={e => {
                              const val = e.target.value;
                              const matched = liveReferences.find(r => r.referenceNo === val);
                              setFormData(prev => ({
                                ...prev,
                                referenceNo: val,
                                ...(matched?.type === 'PO' ? { movementType: 'PO ETA (Inbound)' } : {}),
                                ...(matched?.type === 'SO' ? { movementType: 'SO Outbound Dispatch' } : {})
                              }));
                            }}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 font-mono text-sm text-slate-900 dark:text-white font-medium"
                          />
                          <datalist id="live-po-so-datalist">
                            {liveReferences.map(r => (
                              <option key={r.referenceNo} value={r.referenceNo}>
                                {r.label} [{r.status}]
                              </option>
                            ))}
                          </datalist>
                        </div>
                        {livePOs.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Live Purchase Orders in DB:</span>
                            <div className="flex flex-wrap gap-1">
                              {livePOs.map(poNum => (
                                <button
                                  key={poNum}
                                  type="button"
                                  onClick={() => setFormData(p => ({ ...p, referenceNo: poNum, movementType: 'PO ETA (Inbound)' }))}
                                  className={`text-[11px] font-mono px-2 py-0.5 rounded border transition cursor-pointer ${
                                    formData.referenceNo === poNum
                                      ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600'
                                  }`}
                                >
                                  {poNum}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {liveSOs.length > 0 && (
                          <div className="space-y-1 pt-0.5">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Live Sales Orders:</span>
                            <div className="flex flex-wrap gap-1">
                              {liveSOs.map(soNum => (
                                <button
                                  key={soNum}
                                  type="button"
                                  onClick={() => setFormData(p => ({ ...p, referenceNo: soNum, movementType: 'SO Outbound Dispatch' }))}
                                  className={`text-[11px] font-mono px-2 py-0.5 rounded border transition cursor-pointer ${
                                    formData.referenceNo === soNum
                                      ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-xs'
                                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400 hover:text-amber-600'
                                  }`}
                                >
                                  {soNum}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : f.key === 'workOrderNo' ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            type="text"
                            list="live-wo-datalist"
                            placeholder="Type or select live Work Order (e.g. MP-000005)"
                            value={formData.workOrderNo || ''}
                            onChange={e => {
                              const updated = { ...formData, workOrderNo: e.target.value };
                              setFormData(updated);
                              runConflictCheck(updated, editingEventId);
                            }}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 font-mono text-sm text-slate-900 dark:text-white font-medium"
                          />
                          <datalist id="live-wo-datalist">
                            {liveWOs.map(wo => (
                              <option key={wo} value={wo}>
                                {wo} • Production Work Order
                              </option>
                            ))}
                          </datalist>
                        </div>
                        {liveWOs.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Live Work Orders in DB:</span>
                            <div className="flex flex-wrap gap-1">
                              {liveWOs.map(woNum => (
                                <button
                                  key={woNum}
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...formData, workOrderNo: woNum };
                                    setFormData(updated);
                                    runConflictCheck(updated, editingEventId);
                                  }}
                                  className={`text-[11px] font-mono px-2 py-0.5 rounded border transition cursor-pointer ${
                                    formData.workOrderNo === woNum
                                      ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-xs'
                                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400 hover:text-amber-600'
                                  }`}
                                >
                                  {woNum}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : f.type === 'select' ? (
                      <select
                        value={formData[f.key] || ''}
                        onChange={e => {
                          const updated = { ...formData, [f.key]: e.target.value };
                          setFormData(updated);
                          runConflictCheck(updated, editingEventId);
                        }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
                      >
                        <option value="">Select {f.label}</option>
                        {formData[f.key] && !f.options.includes(formData[f.key]) && (
                          <option value={formData[f.key]}>{formData[f.key]}</option>
                        )}
                        {f.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        value={formData[f.key] || ''}
                        onChange={e => {
                          const updated = { ...formData, [f.key]: e.target.value };
                          setFormData(updated);
                          if (f.key === 'resourceId' || f.key === 'setupTimeMinutes' || f.key === 'runTimeMinutes') {
                            runConflictCheck(updated, editingEventId);
                          }
                        }}
                        className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-slate-900 dark:text-white ${
                          f.mono ? 'font-mono text-indigo-600 dark:text-indigo-400 font-medium' : ''
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* General Operational Notes */}
              <div className="space-y-1 pt-2">
                <label className="font-bold text-slate-600 dark:text-slate-300">Operational Log & Notes</label>
                <textarea
                  rows={3}
                  value={formData.note || ''}
                  onChange={e => setFormData(p => ({ ...p, note: e.target.value }))}
                  placeholder="Additional supervisor notes, operator handoffs, or EHS instructions..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
                />
              </div>
            </form>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#1f2732]/40 flex items-center justify-between gap-3">
              {editingEventId ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{formData.isSystemMilestone ? 'Hide Milestone' : 'Delete'}</span>
                </button>
              ) : <div></div>}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <Button
                  form="drawerForm"
                  type="submit"
                  size="sm"
                  className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
                >
                  {editingEventId ? (isScenarioMode ? 'Stage Simulation' : 'Save Changes') : (isScenarioMode ? 'Stage New Event' : 'Create Event')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. DEPENDENCY CASCADE WARNING MODAL */}
      {pendingCascade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setPendingCascade(null)}></div>
          <div className="relative w-full max-w-lg bg-white dark:bg-[#171d24] border border-amber-300 dark:border-amber-700/60 rounded-2xl p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl shrink-0">
                <GitBranch className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                  Dependency-Aware Rescheduling
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Moving <strong>"{pendingCascade.targetEvent.title}"</strong> to {pendingCascade.newDate} impacts linked downstream operations.
                </p>
              </div>
            </div>

            <div className="py-2 space-y-2 border-y border-slate-100 dark:border-slate-800 my-4 text-xs">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                {pendingCascade.dependents.length} Downstream Operation{pendingCascade.dependents.length !== 1 ? 's' : ''} Detected:
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {pendingCascade.dependents.map(dep => (
                  <div key={dep.id} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="font-semibold truncate max-w-[260px]">{dep.title}</span>
                    <span className="font-mono text-[10px] text-slate-400">{dep.date}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingCascade(null)}
                className="text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => executeReschedule(pendingCascade.targetEvent, pendingCascade.newDate, false)}
                className="text-xs font-semibold cursor-pointer"
              >
                Move Only This Stage
              </Button>
              <Button
                size="sm"
                onClick={() => executeReschedule(pendingCascade.targetEvent, pendingCascade.newDate, true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs cursor-pointer shadow-xs"
              >
                Auto-Shift Downstream Operations
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. OFFICIAL GAZETTE HOLIDAY DETAIL MODAL */}
      {selectedHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={() => setSelectedHoliday(null)}></div>
          <div className="relative w-full max-w-md bg-white dark:bg-[#171d24] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl">
                  🏛️
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">{selectedHoliday.name}</h3>
                  <span className="inline-block mt-0.5 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                    {selectedHoliday.type || 'Official Gazette Holiday'}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedHoliday(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 py-3 border-y border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold">Scheduled Date:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedHoliday.date}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold">Classification:</span>
                <span className="font-medium text-emerald-700 dark:text-emerald-300">
                  {selectedHoliday.gazetted ? 'Mandatory National Gazetted' : 'Public Holiday'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold">Official Source:</span>
                <span className="font-mono text-slate-500 truncate max-w-[200px]">{selectedHoliday.source || 'Govt Gazette Feed'}</span>
              </div>
              {selectedHoliday.note && (
                <div className="pt-1">
                  <span className="text-slate-400 font-semibold block mb-1">Gazette Description:</span>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
                    {selectedHoliday.note}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <Button onClick={() => setSelectedHoliday(null)} variant="outline" size="sm" className="px-4 text-xs font-semibold cursor-pointer">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. DAY DETAIL POPUP MODAL (When clicking + more button) */}
      {dayDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-150"
            onClick={() => setDayDetailModal(null)}
          ></div>
          <div className="relative w-full max-w-xl bg-white dark:bg-[#171d24] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-10 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-[#1f2732]/50 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                      {new Date(dayDetailModal.dateStr + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </h2>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {dayDetailModal.events.length} operation{dayDetailModal.events.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Operational schedule & quality logs for {dayDetailModal.dateStr}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const d = dayDetailModal.dateStr;
                    setDayDetailModal(null);
                    openDrawer(null, d);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Event</span>
                </button>
                <button
                  onClick={() => setDayDetailModal(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content / Event List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              
              {/* Gazette Holidays on this date */}
              {dayDetailModal.holidays.map((h, idx) => (
                <div 
                  key={`modal-hol-${idx}`}
                  onClick={() => {
                    setDayDetailModal(null);
                    setSelectedHoliday(h);
                  }}
                  className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/70 dark:bg-emerald-950/40 flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🏛️</span>
                    <div>
                      <div className="text-xs font-bold text-emerald-900 dark:text-emerald-100">{h.name}</div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300">{h.note || 'Official National Gazette Holiday'}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-200/70 dark:bg-emerald-800/70 text-emerald-900 dark:text-emerald-100 font-bold">
                    Gazette Holiday
                  </span>
                </div>
              ))}

              {/* Machine / Workload Shift Bar if High Load */}
              {dayDetailModal.load && dayDetailModal.load.totalMinutes > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Factory className="w-4 h-4 text-indigo-500" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Shift Queue Load:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {Math.round(dayDetailModal.load.totalMinutes / 60)}h {dayDetailModal.load.totalMinutes % 60}m across {dayDetailModal.load.jobCount} jobs
                    </span>
                  </div>
                  {dayDetailModal.load.totalMinutes > 480 && (
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded">
                      ⚠️ Bottleneck
                    </span>
                  )}
                </div>
              )}

              {/* All Events List */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Scheduled Operations ({dayDetailModal.events.length})
                </div>

                {dayDetailModal.events.map(ev => {
                  const mod = ERP_MODULES[ev.module] || ERP_MODULES.production;
                  const stat = EVENT_STATUSES[ev.status] || EVENT_STATUSES.Scheduled;

                  return (
                    <div
                      key={ev.id}
                      onClick={() => {
                        setDayDetailModal(null);
                        openDrawer(ev.id);
                      }}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-white dark:bg-[#1a2028] shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col gap-2"
                      style={{ borderLeftWidth: '4px', borderLeftColor: stat.color }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold shrink-0" style={{ backgroundColor: mod.bgColor, color: mod.color }}>
                            {mod.name}
                          </span>
                          {ev.time && (
                            <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/50 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                              <Clock className="w-2.5 h-2.5" />
                              {ev.time}
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {ev.title}
                          </span>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                          {ev.status}
                        </span>
                      </div>

                      {/* Relational details row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {ev.referenceNo && (
                          <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                            Ref: {ev.referenceNo}
                          </span>
                        )}
                        {ev.workOrderNo && (
                          <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                            WO: {ev.workOrderNo}
                          </span>
                        )}
                        {ev.routingStage && (
                          <span>Stage: {ev.routingStage}</span>
                        )}
                        {ev.movementType && (
                          <span>Movement: {ev.movementType}</span>
                        )}
                        {ev.carrier && (
                          <span>Carrier: {ev.carrier}</span>
                        )}
                        {ev.dockLocation && (
                          <span>Vehicle: {ev.dockLocation}</span>
                        )}
                      </div>

                      {ev.note && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800 line-clamp-2">
                          {ev.note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#1f2732]/40 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-400">
                Click any operation to edit parameters or manage schedule
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDayDetailModal(null)}
                className="px-4 text-xs font-semibold cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 7. IN-APP POPUP CONFIRMATION DIALOG MODAL */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-150" 
            onClick={() => setConfirmDialog(null)}
          ></div>
          <div className="relative w-full max-w-md bg-white dark:bg-[#171d24] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5 mb-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                confirmDialog.type === 'danger'
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                  : confirmDialog.type === 'warning'
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                  : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60'
              }`}>
                {confirmDialog.type === 'danger' ? (
                  <AlertOctagon className="w-5 h-5" />
                ) : confirmDialog.type === 'warning' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
              <button 
                onClick={() => setConfirmDialog(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDialog(null)}
                className="px-4 text-xs font-semibold cursor-pointer border-slate-200 dark:border-slate-700"
              >
                {confirmDialog.cancelText || 'Cancel'}
              </Button>
              <Button
                size="sm"
                onClick={confirmDialog.onConfirm}
                className={`px-4 text-xs font-semibold cursor-pointer shadow-xs ${
                  confirmDialog.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : confirmDialog.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {confirmDialog.confirmText || 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 8. TOAST NOTIFICATION CONTAINER */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg border text-xs flex items-center gap-2.5 animate-in slide-in-from-bottom-2 duration-150 ${
              t.type === 'delete'
                ? 'bg-rose-950 text-white border-rose-800'
                : t.type === 'reschedule'
                ? 'bg-indigo-950 text-white border-indigo-800'
                : t.type === 'error'
                ? 'bg-amber-950 text-white border-amber-800'
                : t.type === 'info'
                ? 'bg-purple-950 text-white border-purple-800'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            {t.type === 'delete' ? (
              <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
            ) : t.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : t.type === 'reschedule' ? (
              <RotateCcw className="w-4 h-4 text-indigo-400 shrink-0" />
            ) : t.type === 'info' ? (
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <div>
              <div className="font-bold">{t.title}</div>
              <div className="text-[11px] opacity-90">{t.message}</div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
