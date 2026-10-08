import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/axios';

/**
 * usePosHeaderData - POS Header State Management Hook
 * Connects hardware statuses, live network latency ping, device battery, and alert drawer
 */
export function usePosHeaderData(initialConfig = {}) {
  // 1. Network status tracking with browser event listeners and live latency ping
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [pingMs, setPingMs] = useState(18); // Default active ping in ms

  // Measure live latency ping to backend
  const checkPing = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      setPingMs(null);
      return;
    }
    const t0 = performance.now();
    try {
      await api.get('/setup/tax', { timeout: 4000 });
      const elapsed = Math.round(performance.now() - t0);
      setIsOnline(true);
      setPingMs(elapsed);
    } catch {
      // If error or network hiccup
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
        setPingMs(null);
      } else {
        setPingMs(Math.round(performance.now() - t0));
      }
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkPing();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setPingMs(null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial ping and recurring 10-second heartbeat
    checkPing();
    const interval = setInterval(checkPing, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkPing]);

  // 2. Hardware statuses (Printer, Scanner, Drawer)
  const [hardwareStatus, setHardwareStatus] = useState(() => ({
    printer: initialConfig.status?.printer ?? 'connected',
    scanner: initialConfig.status?.scanner ?? 'ready',
    drawer: initialConfig.status?.drawer ?? 'closed',
    ...initialConfig.status
  }));

  // Barcode Scanner detection via fast keyboard buffer (<40ms per keystroke)
  const scanBuffer = useRef([]);
  const lastKeyTime = useRef(Date.now());

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore text input fields when typing normally
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) && e.key !== 'Enter') {
        return;
      }

      const now = Date.now();
      const diff = now - lastKeyTime.current;
      lastKeyTime.current = now;

      if (e.key === 'Enter') {
        if (scanBuffer.current.length >= 4) {
          // Scanner detected
          setHardwareStatus((prev) => ({ ...prev, scanner: 'ready' }));
        }
        scanBuffer.current = [];
      } else if (e.key.length === 1) {
        if (diff > 80) {
          scanBuffer.current = [];
        }
        scanBuffer.current.push(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 3. Device battery level (if Web Battery API is supported)
  const [batteryLevel, setBatteryLevel] = useState(initialConfig.batteryLevel ?? null);
  const [isCharging, setIsCharging] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      let batteryRef = null;

      const updateBattery = (battery) => {
        setBatteryLevel(Math.round(battery.level * 100));
        setIsCharging(battery.charging);
      };

      navigator.getBattery().then((battery) => {
        batteryRef = battery;
        updateBattery(battery);

        battery.addEventListener('levelchange', () => updateBattery(battery));
        battery.addEventListener('chargingchange', () => updateBattery(battery));
      }).catch(() => {});

      return () => {
        if (batteryRef) {
          batteryRef.removeEventListener?.('levelchange', () => updateBattery(batteryRef));
          batteryRef.removeEventListener?.('chargingchange', () => updateBattery(batteryRef));
        }
      };
    }
  }, []);

  // 4. POS Operational Mode ("sale" | "refund" | "training")
  const [mode, setMode] = useState(initialConfig.mode || 'sale');

  // 5. Order Type ("dine-in" | "takeaway" | "delivery")
  const [orderType, setOrderType] = useState(initialConfig.orderType || 'takeaway');

  // 6. Parked / Held Orders Count
  const [heldOrdersCount, setHeldOrdersCount] = useState(initialConfig.heldOrdersCount || 0);

  // 7. Sync State
  const [pendingSyncCount, setPendingSyncCount] = useState(initialConfig.pendingSyncCount || 0);
  const [lastSyncTime, setLastSyncTime] = useState(initialConfig.lastSyncTime || new Date().toISOString());

  // 8. Alerts & Notifications
  const [alerts, setAlerts] = useState(initialConfig.alerts || [
    { id: '1', type: 'info', message: 'Thermal Roll: 68% remaining in Printer 01' },
    { id: '2', type: 'warning', message: 'Cash drawer limit threshold: ₹25,000' }
  ]);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);

  // Hardware toggle helper for simulation or testing
  const toggleHardwareStatus = useCallback((device) => {
    setHardwareStatus((prev) => {
      if (device === 'printer') {
        return { ...prev, printer: prev.printer === 'connected' ? 'disconnected' : 'connected' };
      }
      if (device === 'scanner') {
        return { ...prev, scanner: prev.scanner === 'ready' ? 'error' : 'ready' };
      }
      if (device === 'drawer') {
        return { ...prev, drawer: prev.drawer === 'closed' ? 'open' : 'closed' };
      }
      return prev;
    });
  }, []);

  return {
    isOnline,
    pingMs,
    checkPing,
    hardwareStatus,
    setHardwareStatus,
    toggleHardwareStatus,
    batteryLevel,
    isCharging,
    mode,
    setMode,
    orderType,
    setOrderType,
    heldOrdersCount,
    setHeldOrdersCount,
    pendingSyncCount,
    setPendingSyncCount,
    lastSyncTime,
    setLastSyncTime,
    alerts,
    setAlerts,
    isAlertsOpen,
    setIsAlertsOpen
  };
}

export default usePosHeaderData;
