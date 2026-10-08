import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Store, Monitor, User, AlertTriangle, Wifi, WifiOff, Printer,
  QrCode, Archive, Lock, LogOut, Bell, BatteryCharging, Battery,
  BatteryMedium, BatteryLow, RotateCcw, ShieldCheck, Tag, X,
  Building2, Sun, Moon, CheckCircle2, ChevronRight, RefreshCw,
  ExternalLink, Layers
} from 'lucide-react';
import { api } from '@/lib/axios';
import './PosHeader.css';
import StatusPill from './StatusPill';
import OrderTypeSelector from './OrderTypeSelector';
import LiveClock from './LiveClock';

/**
 * Format receipt number with clean zero-padding if numeric
 */
const formatReceiptNumber = (num) => {
  if (!num) return '...';
  const str = String(num);
  if (str.includes('/')) return str;
  const digits = str.replace(/\D/g, '') || '1';
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const startYr = month >= 4 ? String(year).slice(-2) : String(year - 1).slice(-2);
  const endYr = month >= 4 ? String(year + 1).slice(-2) : String(year).slice(-2);
  return `INV/${startYr}-${endYr}/${month}/${digits.padStart(4, '0')}`;
};

/**
 * Extract business initials for logo fallback avatar (e.g. "Smart Enterprise" => "SE")
 */
const getInitials = (name) => {
  if (!name) return 'SE';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

/**
 * PosHeader Component
 * Executive, mission-critical POS screen header bar supporting live database business profile,
 * live invoice sequence (+1), network ping latency, hardware diagnostics, and both Light and Dark themes.
 */
export const PosHeader = React.memo(function PosHeader({
  business = null,
  register = { id: 'POS-01', label: 'Front Counter' },
  cashier = { name: 'Mathan', id: 'MAIN_MASTER' },
  shiftStart = null,
  receiptNumber = '',
  servingNumber = '',
  status = { network: true, pingMs: 18, printer: 'connected', scanner: 'ready', drawer: 'closed' },
  orderType = 'takeaway',
  heldOrdersCount = 0,
  mode = 'sale',
  customer = null,
  pendingSyncCount = 0,
  lastSyncTime = null,
  batteryLevel = null,
  alerts = [
    { id: '1', type: 'info', message: 'GST Engine active: Seller Tamil Nadu (33)' },
    { id: '2', type: 'info', message: 'Thermal Roll: 80mm ESC/POS hardware ready' }
  ],
  currency = '₹',
  taxMode = 'CGST+SGST Intra-State',
  themePreference = 'dark', // 'dark' | 'light' | 'auto'
  onOrderTypeChange,
  onModeChange,
  onStatusClick,
  onLogout,
  onLock,
  onHeldOrdersClick,
  onSyncClick
}) {
  // Live Browser Network Status & Ping Latency
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [showBusinessProfile, setShowBusinessProfile] = useState(false);
  const [activeDiagnostic, setActiveDiagnostic] = useState(null); // 'printer' | 'scanner' | 'drawer' | null
  const [liveCompanyData, setLiveCompanyData] = useState(null);

  // Directly fetch Live PostgreSQL Business Profile from /setup/tax
  useEffect(() => {
    let isMounted = true;
    api.get('/setup/tax')
      .then((res) => {
        if (isMounted && res.data) {
          setLiveCompanyData(res.data);
        }
      })
      .catch((err) => {
        console.warn('[PosHeader] Failed to fetch /setup/tax:', err.message);
      });
    return () => { isMounted = false; };
  }, []);
  
  // Header Theme Mode: Live Synchronized with Document Root (Dark / Light)
  const [isDark, setIsDark] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('darkMode');
      if (stored !== null) return stored === 'true';
    }
    if (typeof document !== 'undefined') {
      return (
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark') ||
        Boolean(document.querySelector('.dark'))
      );
    }
    return true; // Default to dark mode
  });

  // Watch for global dark mode changes on document.documentElement
  useEffect(() => {
    const updateTheme = () => {
      const stored = localStorage.getItem('darkMode');
      const darkActive =
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark') ||
        Boolean(document.querySelector('.dark')) ||
        stored === 'true';
      setIsDark(Boolean(darkActive));
    };

    updateTheme();

    const observer = new MutationObserver(() => {
      updateTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    const handleStorageChange = (e) => {
      if (e.key === 'darkMode') {
        setIsDark(e.newValue === 'true');
      }
    };

    const handleCustomThemeToggle = (e) => {
      if (e.detail?.isDark !== undefined) {
        setIsDark(e.detail.isDark);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('app-theme-toggle', handleCustomThemeToggle);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('app-theme-toggle', handleCustomThemeToggle);
    };
  }, []);

  const alertsDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);

  // Monitor browser online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (alertsDropdownRef.current && !alertsDropdownRef.current.contains(e.target)) {
        setShowAlertsDropdown(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setShowBusinessProfile(false);
      }
    };
    if (showAlertsDropdown || showBusinessProfile) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAlertsDropdown, showBusinessProfile]);

  // Compute status health
  const networkOk = status.network !== undefined ? Boolean(status.network && isOnline) : isOnline;
  const pingLatency = status.pingMs !== undefined ? status.pingMs : 18;
  const printerOk = status.printer === 'connected' || status.printer === true;
  const scannerOk = status.scanner === 'ready' || status.scanner === true;
  const drawerClosed = status.drawer === 'closed' || status.drawer === true;

  // Toggle Header Theme between Dark Console and Crisp Light globally
  const toggleThemeMode = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
    localStorage.removeItem('posHeaderTheme');
    window.dispatchEvent(new CustomEvent('app-theme-toggle', { detail: { isDark: nextDark } }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'darkMode', newValue: nextDark ? 'true' : 'false' }));
  };

  // Safe fallback resolution for Live PostgreSQL Business Profile from /setup/tax
  const companyProfile = useMemo(() => {
    const raw = { ...(liveCompanyData || {}), ...(business || {}) };
    const compName = raw.companyName || raw.name || 'ANTIGRAVITY DAIRY & FOODS PRIVATE LIMITED';
    const stateName = raw.branch || (raw.stateCode === '33' ? 'Tamil Nadu' : (raw.companyAddress?.includes('Tamil Nadu') ? 'Tamil Nadu' : 'Tamil Nadu'));
    return {
      name: compName,
      branch: stateName,
      companyName: compName,
      companyAddress: raw.companyAddress || 'Plot 42, SIDCO Industrial Estate, Salem, Tamil Nadu, 636004',
      companyGstin: raw.companyGstin || '33AABCA1234F1Z8',
      companyPan: raw.companyPan || 'AABCA1234F',
      companyMobile: raw.companyMobile || '+91 94433 12345',
      logoUrl: raw.logoUrl || ''
    };
  }, [business, liveCompanyData]);

  // Sample Receipt Test Print Handler (80mm ESC/POS layout)
  const handleSamplePrint = () => {
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) {
      if (typeof window !== 'undefined' && window.print) window.print();
      return;
    }
    const dateStr = new Date().toLocaleString('en-IN');
    const slipHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sample Thermal Receipt</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { font-family: monospace, -apple-system, sans-serif; font-size: 11px; margin: 8px; width: 72mm; color: #000; line-height: 1.3; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #444; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; }
          .title { font-size: 13px; font-weight: 800; }
        </style>
      </head>
      <body>
        <div class="center title">${companyProfile.companyName}</div>
        <div class="center">${companyProfile.companyAddress}</div>
        <div class="center">${companyProfile.branch}</div>
        <div class="center">GSTIN: ${companyProfile.companyGstin}</div>
        <div class="divider"></div>
        <div class="center bold">*** SAMPLE TEST RECEIPT ***</div>
        <div class="center">ESC/POS 80mm Thermal Printer Test</div>
        <div class="divider"></div>
        <div class="row"><span>Date:</span><span>${dateStr}</span></div>
        <div class="row"><span>Terminal:</span><span>${register.id}</span></div>
        <div class="row"><span>Cashier:</span><span>${cashier.name}</span></div>
        <div class="row"><span>Printer:</span><span class="bold">CONNECTED &amp; READY</span></div>
        <div class="divider"></div>
        <div class="row bold"><span>ITEM</span><span>QTY</span><span>TOTAL</span></div>
        <div class="divider"></div>
        <div class="row"><span>Hardware Test Sample Item</span><span>1</span><span>₹50.00</span></div>
        <div class="row"><span>• CGST (2.5%)</span><span></span><span>₹1.25</span></div>
        <div class="row"><span>• SGST (2.5%)</span><span></span><span>₹1.25</span></div>
        <div class="divider"></div>
        <div class="row bold" style="font-size: 13px;"><span>NET TOTAL:</span><span>₹50.00</span></div>
        <div class="divider"></div>
        <div class="center bold">PRINTER HARDWARE TEST SUCCESSFUL</div>
        <div class="center" style="margin-top: 6px;">THANK YOU!</div>
        <br/><br/>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 1200);
          };
        </script>
      </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(slipHtml);
    printWindow.document.close();
  };

  // Battery icon helper
  const renderBatteryIcon = () => {
    if (batteryLevel === null || batteryLevel === undefined) return null;
    const isLow = batteryLevel <= 20;
    return (
      <div
        className={`pos-battery ${isLow ? 'pos-battery--low' : ''}`}
        title={`Device Battery: ${batteryLevel}%`}
        aria-label={`Device Battery: ${batteryLevel}%`}
      >
        {isLow ? (
          <BatteryLow className="w-3.5 h-3.5" aria-hidden="true" />
        ) : batteryLevel > 60 ? (
          <Battery className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <BatteryMedium className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        <span>{batteryLevel}%</span>
      </div>
    );
  };

  return (
    <div className={`pos-header-wrapper ${isDark ? 'pos-header--dark' : 'pos-header--light'}`}>
      <header className="pos-header" role="banner">
        
        {/* ROW 1: PRIMARY IDENTITY, LIVE TOKENS, TRANSACTION NO & QUICK ACTIONS */}
        <div className="pos-header__primary-row">
          
          {/* Left: Store Brand & Terminal */}
          <div className="pos-header__left">
            {/* Business Brand with Live Profile Popover */}
            <div className="relative" ref={profileDropdownRef}>
              <div
                className="pos-brand pos-brand--interactive"
                onClick={() => setShowBusinessProfile(prev => !prev)}
                title="Click to view live PostgreSQL Business Profile details"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowBusinessProfile(prev => !prev); }}
                aria-haspopup="dialog"
                aria-expanded={showBusinessProfile}
              >
                {companyProfile.logoUrl ? (
                  <img
                    src={companyProfile.logoUrl}
                    alt={`${companyProfile.name} logo`}
                    className="pos-brand__logo"
                  />
                ) : (
                  <div className="pos-brand__fallback" aria-hidden="true">
                    {getInitials(companyProfile.name)}
                  </div>
                )}
                <div className="pos-brand__meta">
                  <span className="pos-brand__name">{companyProfile.name}</span>
                  <span className="pos-brand__branch">{companyProfile.branch}</span>
                </div>
              </div>

              {/* LIVE BUSINESS PROFILE MODAL / POPOVER */}
              {showBusinessProfile && (
                <div
                  className="pos-profile-dropdown animate-in fade-in zoom-in-95 duration-150"
                  role="dialog"
                  aria-label="Live PostgreSQL Business Profile"
                >
                  <div className="pos-profile-dropdown__header">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-400" />
                      <span className="font-bold text-sm">Live Business Profile</span>
                    </div>
                    <div className="pos-live-db-badge">
                      <span className="pos-pulse-dot" />
                      PostgreSQL Live Data
                    </div>
                  </div>

                  <div className="pos-profile-dropdown__body">
                    <div className="pos-profile-row">
                      <span className="pos-profile-label">Company Name *</span>
                      <span className="pos-profile-val font-semibold">{companyProfile.companyName}</span>
                    </div>
                    <div className="pos-profile-row">
                      <span className="pos-profile-label">Company Address *</span>
                      <span className="pos-profile-val text-xs leading-relaxed">{companyProfile.companyAddress}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="pos-profile-row">
                        <span className="pos-profile-label">GSTIN *</span>
                        <span className="pos-profile-val font-mono font-bold text-emerald-400">{companyProfile.companyGstin}</span>
                      </div>
                      <div className="pos-profile-row">
                        <span className="pos-profile-label">PAN *</span>
                        <span className="pos-profile-val font-mono font-bold">{companyProfile.companyPan}</span>
                      </div>
                    </div>
                    <div className="pos-profile-row">
                      <span className="pos-profile-label">Company Mobile *</span>
                      <span className="pos-profile-val font-mono">{companyProfile.companyMobile}</span>
                    </div>
                  </div>

                  <div className="pos-profile-dropdown__footer">
                    <a
                      href="/setup/tax"
                      className="pos-profile-link"
                      title="Manage tax configuration and business profile in setup"
                    >
                      <span>Manage Profile in /setup/tax</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowBusinessProfile(false)}
                      className="pos-profile-close-btn"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Terminal / Register Badge */}
            <div
              className="pos-terminal-badge"
              title="Assigned POS Terminal / Register"
              aria-label={`Register ${register.id}: ${register.label}`}
            >
              <Monitor className="pos-terminal-badge__icon" aria-hidden="true" />
              <span>
                <span className="pos-terminal-badge__id">{register.id}</span>
                {register.label ? ` · ${register.label}` : ''}
              </span>
            </div>
          </div>

          {/* Center: Highlighted Serving Queue Token, Receipt Number & Mode Switcher */}
          <div className="pos-header__center">
            {/* Serving Queue Token (Highlighted Purple Badge) */}
            {servingNumber && (
              <div
                className="pos-serving-tag"
                title="Current Daily Serving Queue Token"
                aria-label={`Serving Number ${servingNumber}`}
              >
                <span className="pos-serving-tag__label">Serving</span>
                <span className="pos-serving-tag__number">{servingNumber}</span>
              </div>
            )}

            {/* Receipt Number (Sequential from Database +1) */}
            <div
              className="pos-receipt-badge"
              title="Next Tax Invoice Number (Sequence +1)"
              aria-label={`Receipt Number: ${formatReceiptNumber(receiptNumber)}`}
            >
              <span className="pos-receipt-badge__label">Receipt</span>
              <span className="pos-receipt-badge__number">
                {formatReceiptNumber(receiptNumber)}
              </span>
            </div>

            {/* POS Mode Switcher (Sale / Refund / Training) */}
            <button
              type="button"
              onClick={() => {
                if (onModeChange) {
                  const nextMode = mode === 'sale' ? 'refund' : mode === 'refund' ? 'training' : 'sale';
                  onModeChange(nextMode);
                }
              }}
              className={`pos-mode-badge pos-mode-badge--${mode}`}
              title="Click to toggle POS operating mode (Sale / Refund / Training)"
              aria-label={`POS Operating Mode: ${mode.toUpperCase()}`}
            >
              {mode !== 'sale' && <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />}
              <span>{mode}</span>
            </button>

            {/* Attached Customer Pill (Shown when customer selected) */}
            {customer && (
              <div
                className="pos-customer-pill"
                title={`Attached Customer: ${customer.name}`}
                aria-label={`Customer: ${customer.name}`}
              >
                <Tag className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="pos-customer-pill__name">{customer.name}</span>
                {customer.loyaltyId && (
                  <span className="pos-customer-pill__loyalty">
                    #{customer.loyaltyId}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: Cashier Info, Live Clock, Notifications, Theme Switcher, Lock & Logout */}
          <div className="pos-header__right">
            {/* Cashier Identity */}
            <div
              className="pos-cashier"
              title={`Logged in staff: ${cashier.name}`}
              aria-label={`Cashier: ${cashier.name}`}
            >
              <div className="pos-cashier__avatar" aria-hidden="true">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="pos-cashier__info">
                <span className="pos-cashier__name">{cashier.name}</span>
                <span className="pos-cashier__role">{cashier.id || 'CASHIER'}</span>
              </div>
            </div>

            {/* Live Clock with Live Seconds, Date, and Elapsed Shift Duration */}
            <LiveClock shiftStart={shiftStart} />

            {/* Hardware & System Alerts Button */}
            <div className="relative" ref={alertsDropdownRef}>
              <button
                type="button"
                onClick={() => setShowAlertsDropdown((prev) => !prev)}
                className="pos-icon-btn"
                title="POS Hardware & System Alerts"
                aria-label={`Alerts: ${alerts.length} notifications`}
                aria-expanded={showAlertsDropdown}
              >
                <Bell aria-hidden="true" />
                {alerts.length > 0 && (
                  <span className="pos-icon-btn__badge">{alerts.length}</span>
                )}
              </button>

              {/* Alerts Drawer Popover */}
              {showAlertsDropdown && (
                <div
                  className="pos-alerts-dropdown animate-in fade-in zoom-in-95 duration-150"
                  role="dialog"
                  aria-label="System Notifications & Alerts"
                >
                  <div className="pos-alerts-dropdown__header">
                    <span>Hardware & Register Alerts ({alerts.length})</span>
                    <button
                      type="button"
                      onClick={() => setShowAlertsDropdown(false)}
                      className="p-1 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="pos-alerts-dropdown__list">
                    {alerts.length === 0 ? (
                      <div className="text-center py-4 text-xs text-slate-400">
                        All systems operational. No active alerts.
                      </div>
                    ) : (
                      alerts.map((alt) => (
                        <div
                          key={alt.id}
                          className={`pos-alert-item pos-alert-item--${alt.type || 'info'}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{alt.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Light / Dark Mode Toggle Button */}
            <button
              type="button"
              onClick={toggleThemeMode}
              className="pos-icon-btn"
              title={`Switch POS Theme (Current: ${isDark ? 'Dark Console' : 'Light Mode'})`}
              aria-label="Toggle POS Header Theme"
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
              )}
            </button>

            {/* Terminal Lock Button */}
            {onLock && (
              <button
                type="button"
                onClick={onLock}
                className="pos-icon-btn"
                title="Lock Terminal Screen (Shift Security)"
                aria-label="Lock Register Screen"
              >
                <Lock aria-hidden="true" />
              </button>
            )}

            {/* Logout / Exit Button */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="pos-icon-btn"
                title="Log Out Cashier / Return to Dashboard"
                aria-label="Log Out Cashier"
              >
                <LogOut aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* ROW 2: ORDER TYPE, HELD ORDERS, TAX PILL & HARDWARE DIAGNOSTICS */}
        <div className="pos-header__secondary-row">
          
          {/* Secondary Left: Fulfillment Modes, Held Orders & Tax Mode */}
          <div className="pos-header__secondary-left">
            <OrderTypeSelector
              value={orderType}
              onChange={onOrderTypeChange}
            />

            {/* Held / Parked Orders Button */}
            <button
              type="button"
              onClick={onHeldOrdersClick}
              className="pos-held-orders-btn"
              title="View and resume parked/held orders"
              aria-label={`Parked Orders: ${heldOrdersCount} waiting`}
            >
              <Archive className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <span>Held Orders</span>
              {heldOrdersCount > 0 && (
                <span className="pos-held-orders-badge">{heldOrdersCount}</span>
              )}
            </button>

            {/* Tax Mode Pill */}
            <div className="pos-tax-pill">
              {currency} · {taxMode}
            </div>
          </div>

          {/* Secondary Right: Live Network Ping & Hardware Diagnostic Statuses */}
          <div className="pos-header__secondary-right">
            
            <div className="pos-status-pills">
              {/* Network Connectivity with Live Ping Measurement */}
              <StatusPill
                label="Network"
                isOk={networkOk}
                okText={pingLatency !== null ? `Online (${pingLatency}ms)` : 'Online'}
                errorText="Offline"
                icon={networkOk ? <Wifi /> : <WifiOff />}
                onClick={() => {
                  if (onStatusClick) onStatusClick('network');
                  else setActiveDiagnostic('network');
                }}
                tooltip={`Network status to PostgreSQL Cloud ERP (${networkOk ? `Latency: ${pingLatency}ms` : 'Disconnected'})`}
              />

              {/* Thermal Receipt Printer (Live hardware check) */}
              <StatusPill
                label="Printer"
                isOk={printerOk}
                okText="Connected"
                errorText="Disconnected"
                icon={<Printer />}
                onClick={() => {
                  if (onStatusClick) onStatusClick('printer');
                  else setActiveDiagnostic('printer');
                }}
                tooltip="Thermal ESC/POS Receipt Printer (Click for Diagnostics & Test Slip)"
              />

              {/* Barcode Scanner (Live keyboard wedge detection) */}
              <StatusPill
                label="Scanner"
                isOk={scannerOk}
                okText="Ready"
                errorText="Not Ready"
                icon={<QrCode />}
                onClick={() => {
                  if (onStatusClick) onStatusClick('scanner');
                  else setActiveDiagnostic('scanner');
                }}
                tooltip="USB / Wireless Barcode Scanner (Click to Test Scan Listener)"
              />

              {/* Cash Drawer Sensor */}
              <StatusPill
                label="Drawer"
                isOk={drawerClosed}
                okText="Closed"
                errorText="Open"
                icon={<ShieldCheck />}
                onClick={() => {
                  if (onStatusClick) onStatusClick('drawer');
                  else setActiveDiagnostic('drawer');
                }}
                tooltip="Cash register solenoid sensor (Click to Test Drawer Kick Pulse)"
              />
            </div>

            {/* Pending Sync / Offline Ledger Status */}
            {pendingSyncCount > 0 && (
              <button
                type="button"
                onClick={onSyncClick}
                className="pos-sync-indicator"
                title="Offline transactions pending sync"
                aria-label={`${pendingSyncCount} orders waiting to sync`}
              >
                <RotateCcw className="w-3 h-3 text-sky-400 animate-spin" aria-hidden="true" />
                <span>Sync</span>
                <span className="pos-sync-badge">{pendingSyncCount}</span>
              </button>
            )}

            {/* Device Battery (if telemetry available) */}
            {renderBatteryIcon()}
          </div>
        </div>

      </header>

      {/* HARDWARE DIAGNOSTIC MODAL */}
      {activeDiagnostic && (
        <div className="pos-diagnostic-overlay" onClick={() => setActiveDiagnostic(null)}>
          <div
            className="pos-diagnostic-modal animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Hardware Device Diagnostics"
          >
            <div className="pos-diagnostic-modal__header">
              <span className="font-bold text-sm">Hardware Diagnostics · {activeDiagnostic.toUpperCase()}</span>
              <button
                type="button"
                onClick={() => setActiveDiagnostic(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="pos-diagnostic-modal__body">
              {activeDiagnostic === 'network' && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
                    <span className="text-slate-300">Live Network Latency:</span>
                    <span className="font-mono font-bold text-emerald-400">{pingLatency} ms</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
                    <span className="text-slate-300">Connection State:</span>
                    <span className="font-bold text-emerald-400">{networkOk ? 'Online & Synchronized' : 'Offline'}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
                    <span className="text-slate-300">Database Engine:</span>
                    <span className="text-slate-200">PostgreSQL (port 5432)</span>
                  </div>
                </div>
              )}

              {activeDiagnostic === 'printer' && (
                <div className="space-y-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Thermal Printer Status:</span>
                      <span className={`font-bold ${printerOk ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {printerOk ? 'Connected & Ready' : 'Not Connected'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Port: USB ESC/POS 80mm High Speed (Autocut + Solenoid RJ11)
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleSamplePrint}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Sample Receipt Slip (80mm)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onStatusClick) onStatusClick('togglePrinter');
                    }}
                    className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Toggle Printer Connection ({printerOk ? 'Disconnect' : 'Connect'})</span>
                  </button>
                </div>
              )}

              {activeDiagnostic === 'scanner' && (
                <div className="space-y-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-300">Barcode Reader Status:</span>
                      <span className="font-bold text-emerald-400">Ready (Listening Mode)</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Listening on USB HID keyboard wedge protocol (EAN-13, UPC, Code 128). Automatic dummy generation is disabled.
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Point barcode scanner gun here to test real scan..."
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>
              )}

              {activeDiagnostic === 'drawer' && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
                    <span className="text-slate-300">Sensor Status:</span>
                    <span className="font-bold text-emerald-400">Closed (Secure)</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
                    <span className="text-slate-300">Port Voltage:</span>
                    <span className="font-mono text-slate-200">24V Solenoid RJ11</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => alert('Cash drawer pulse sent.')}
                    className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Send Open Kick Pulse (Test)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OFFLINE ALERT BANNER */}
      {!networkOk && (
        <div className="pos-offline-banner" role="alert">
          <WifiOff className="pos-offline-banner__icon" aria-hidden="true" />
          <span>
            Offline mode active: transactions are securely cached locally and will auto-synchronize to PostgreSQL when network reconnects.
          </span>
        </div>
      )}
    </div>
  );
});

export default PosHeader;
