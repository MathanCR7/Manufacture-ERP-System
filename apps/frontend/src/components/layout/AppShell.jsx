import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '@/app/store/authStore';
import { 
  LayoutDashboard, ShoppingCart, FlaskConical, Factory, 
  DollarSign, Settings, Moon, Sun, Clock, 
  User, LogOut, ChevronDown, ChevronRight, ChevronLeft, Plus, Minus,
  Menu, X, Users, Archive, Search, QrCode, ScanLine, XCircle, FileText, Bell,
  AlertTriangle, TrendingUp, Layers, Camera, Upload, Image, VideoOff, HardDrive,
  BarChart2, ShoppingBag, Package, Wallet, UserCheck, Wrench
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import useLanguageStore from '@/app/store/languageStore';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '@/lib/axios';

const GlobalSearch = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (query.trim().length < 2) { setResults(null); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
        setResults(res.data.results);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (link) => {
    navigate(link);
    onClose();
  };

  // Search local navigation items matching user role & query
  const matchedNavItems = [];
  if (query.trim().length >= 2) {
    const qLower = query.toLowerCase();
    MENU_GROUPS.forEach(group => {
      if (group.roles.includes(user?.role)) {
        group.items.forEach(item => {
          if (item.roles.includes(user?.role)) {
            if (item.name.toLowerCase().includes(qLower) || group.title.toLowerCase().includes(qLower)) {
              matchedNavItems.push({
                id: `nav-${item.path}`,
                label: item.name,
                subtitle: `Page in ${group.title}`,
                link: item.path
              });
            }
          }
        });
      }
    });
  }

  const categories = results 
    ? Object.entries({
        navigationPages: matchedNavItems,
        ...results
      }).filter(([_, items]) => items && items.length > 0)
    : (matchedNavItems.length > 0 ? [['navigationPages', matchedNavItems]] : []);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-center items-start pt-20 px-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input 
            type="text" autoFocus value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search POs, GRNs, Suppliers, Customers, Inventory..."
            className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 text-lg"
          />
          {loading && <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />}
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          {query.trim().length < 2 ? (
            <div className="p-8 text-center text-slate-400">Type at least 2 characters to search across the ERP</div>
          ) : categories.length === 0 && !loading && results ? (
            <div className="p-8 text-center text-slate-400">No results found for "{query}"</div>
          ) : (
            categories.map(([key, items]) => (
              <div key={key} className="mb-4">
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                {items.map(item => (
                  <button key={item.id} onClick={() => handleSelect(item.link)} className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl flex items-center gap-3 group transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-505 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{item.label}</p>
                      <p className="text-xs text-slate-505 dark:text-slate-400">{item.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const QRScannerModal = ({ onClose, onScan }) => {
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const qrCodeInstance = useRef(null);

  useEffect(() => {
    const instance = new Html5Qrcode("reader");
    qrCodeInstance.current = instance;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
          const defaultCamId = backCam ? backCam.id : devices[0].id;
          setSelectedCameraId(defaultCamId);
        } else {
          setErrorMsg("No cameras found on this device.");
        }
      })
      .catch((err) => {
        console.error("Error getting cameras", err);
        setErrorMsg("Failed to list cameras. Please grant camera permission.");
      });

    return () => {
      if (instance && instance.isScanning) {
        instance.stop()
          .then(() => {
            try { instance.clear(); } catch (e) {}
          })
          .catch((err) => console.error("Error stopping instance on unmount", err));
      } else if (instance) {
        try {
          instance.clear();
        } catch (e) {
          console.error("Error clearing on unmount", e);
        }
      }
    };
  }, []);

  const startCamera = async (cameraId) => {
    if (!qrCodeInstance.current) return;
    try {
      setErrorMsg('');
      if (qrCodeInstance.current.isScanning) {
        await qrCodeInstance.current.stop();
      }

      await qrCodeInstance.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: (width, height) => {
            const min = Math.min(width, height);
            const size = Math.floor(min * 0.65);
            return { width: size, height: size };
          }
        },
        (decodedText) => {
          handleSuccess(decodedText);
        },
        (errorMessage) => {}
      );
      setIsScanning(true);
    } catch (err) {
      console.error("Failed to start camera", err);
      setErrorMsg("Failed to access camera: " + (err.message || "Unknown error"));
      setIsScanning(false);
    }
  };

  const stopCamera = async () => {
    if (qrCodeInstance.current && qrCodeInstance.current.isScanning) {
      try {
        await qrCodeInstance.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error("Failed to stop camera", err);
      }
    }
  };

  useEffect(() => {
    if (selectedCameraId) {
      startCamera(selectedCameraId);
    }
  }, [selectedCameraId]);

  const handleSuccess = async (text) => {
    await stopCamera();
    onScan(text);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    try {
      await stopCamera();
      const decodedText = await qrCodeInstance.current.scanFile(file, false);
      handleSuccess(decodedText);
    } catch (err) {
      console.error("Failed to scan file", err);
      setErrorMsg("No valid QR code found in this image. Please make sure the code is clear and well-lit.");
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setErrorMsg('');
      try {
        await stopCamera();
        const decodedText = await qrCodeInstance.current.scanFile(file, false);
        handleSuccess(decodedText);
      } catch (err) {
        console.error("Failed to scan dropped file", err);
        setErrorMsg("No valid QR code found in the dropped image.");
      }
      return;
    }

    const text = e.dataTransfer.getData('text/plain');
    if (text) {
      handleSuccess(text);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex justify-center items-center px-4" onClick={onClose}>
      <style>{`
        @keyframes scan-line {
          0% { top: 10%; }
          50% { top: 90%; }
          100% { top: 10%; }
        }
        .scanner-laser {
          position: absolute;
          left: 10%;
          right: 10%;
          height: 3px;
          background: linear-gradient(90deg, transparent, #6366f1, transparent);
          animation: scan-line 3s infinite linear;
          box-shadow: 0 0 10px #6366f1, 0 0 20px rgba(99, 102, 241, 0.5);
          z-index: 20;
        }
      `}</style>
      <div 
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={handleDrop}
        className="bg-slate-900/95 dark:bg-slate-950/95 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 text-slate-100 flex flex-col" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm">
              <QrCode className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Scan QR Code</h3>
              <p className="text-xs text-slate-400 mt-0.5">Real-time scan, drag & drop, or file upload</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors border border-transparent hover:border-slate-800"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-850 flex flex-col items-center justify-center text-center group ring-4 ring-indigo-500/5 mb-5 shadow-inner">
          {isScanning && <div className="scanner-laser"></div>}
          
          <div id="reader" className={`w-full h-full absolute inset-0 ${isScanning ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}></div>
          
          {!isScanning && (
            <div className="z-10 flex flex-col items-center space-y-3 p-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 group-hover:bg-indigo-950/30 border border-slate-800 group-hover:border-indigo-500/20 transition-all">
                <VideoOff className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Camera is off</p>
                <p className="text-xs text-slate-500 mt-1">Activate the scanner or upload an image below</p>
              </div>
              {selectedCameraId && (
                <button 
                  onClick={() => startCamera(selectedCameraId)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-semibold rounded-xl transition-all shadow-md hover:shadow-indigo-500/10"
                >
                  <Camera className="w-3.5 h-3.5" /> Start Scanning
                </button>
              )}
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mb-5 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex gap-2.5 items-start text-xs text-rose-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        <div className="space-y-4">
          {cameras.length > 0 && (
            <div className="w-full">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 text-left uppercase tracking-wider">Select Device</label>
              <div className="relative">
                <select
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  className="w-full bg-slate-850 hover:bg-slate-800 text-slate-200 text-xs rounded-xl pl-4 pr-10 py-2.5 border border-slate-800/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer transition-colors"
                >
                  {cameras.map((cam) => (
                    <option key={cam.id} value={cam.id} className="bg-slate-900 text-slate-200">
                      {cam.label || `Camera ${cameras.indexOf(cam) + 1}`}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5 pt-1">
            {isScanning ? (
              <button
                onClick={stopCamera}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold py-2.5 px-4 rounded-xl shadow transition-colors text-xs"
              >
                <VideoOff className="w-4 h-4 text-slate-400" />
                Pause Camera
              </button>
            ) : (
              <button
                disabled={!selectedCameraId}
                onClick={() => selectedCameraId && startCamera(selectedCameraId)}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-750 disabled:opacity-50 disabled:hover:bg-slate-800 text-slate-200 font-semibold py-2.5 px-4 rounded-xl shadow transition-colors text-xs"
              >
                <Camera className="w-4 h-4 text-indigo-400" />
                Start Camera
              </button>
            )}

            <label className="w-full inline-flex items-center justify-center gap-1.5 bg-indigo-650 hover:bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-xl cursor-pointer shadow transition-all text-xs">
              <Upload className="w-4 h-4" />
              Upload Image
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-center text-[10px] text-slate-500">
            Tip: Drag and drop a QR code image from your desktop or the page to scan it instantly!
          </p>
        </div>
      </div>
    </div>
  );
};

// --- Menu Configuration based on Permissions Matrix ---
const MENU_GROUPS = [
  {
    id: 'dashboards',
    title: 'Dashboards',
    icon: BarChart2,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT', 'PRODUCTION_STAFF', 'SALES_TEAM'],
    items: [
      { name: '📊 Overall Dashboard',     path: '/dashboard',             roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT', 'PRODUCTION_STAFF', 'SALES_TEAM'] },
      { name: '🏢 Executive / CEO',        path: '/dashboard/executive',   roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '🧾 Sales',                  path: '/dashboard/sales',       roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'SALES_TEAM'] },
      { name: '🏭 Production',             path: '/dashboard/production',  roles: ['MAIN_MASTER', 'SUPERVISOR', 'PRODUCTION_STAFF'] },
      { name: '📦 Inventory / Stock',      path: '/dashboard/inventory',   roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT'] },
      { name: '💰 Finance',               path: '/dashboard/finance',     roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'] },
      { name: '🧑‍💼 HR / Workforce',       path: '/dashboard/hr',          roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '🛠 Maintenance / Assets',   path: '/dashboard/maintenance', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
    ]
  },
  {
    id: 'purchases',
    title: 'Purchases',
    icon: ShoppingCart,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT'],
    items: [
      { name: '🛒 Purchase Order', path: '/purchase-orders', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER'] },
      { name: '🚚 Upcoming Deliveries', path: '/grn/upcoming', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'] },
      { name: '📥 GRN Records', path: '/grn/list', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT'] },
      { name: '🔄 Purchase Return', path: '/purchase-return/list', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT'] },
    ]
  },
  {
    id: 'assetManagement',
    title: 'Asset Management',
    icon: HardDrive,
    roles: ['MAIN_MASTER', 'SUPERVISOR'],
    items: [
      { name: '📨 Purchase Requests', path: '/asset-management/requests', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '💬 Purchase Quotations', path: '/asset-management/quotations', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '📄 Purchase Orders', path: '/asset-management/orders', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '📦 Goods Receipt PO', path: '/asset-management/grpo', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '🧾 A/P Invoice', path: '/asset-management/invoice', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '🗃️ Asset Register', path: '/asset-management/register', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '📈 Reports & Analytics', path: '/asset-management/reports', roles: ['MAIN_MASTER', 'SUPERVISOR'] }
    ]
  },
  {
    id: 'lab',
    title: 'Lab Testing',
    icon: FlaskConical,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT'],
    items: [
      { name: '🧪 Pending RM Lab Tests', path: '/lab/pending', roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT'] },
      { name: '🔬 RM Lab Results', path: '/lab/results', roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT'] },
      { name: '🏷️ RM Lab Category', path: '/lab/rm-lab-category', roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT'] },
      { name: '📦 Lab Inventory', path: '/lab-inventory/list', roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT'] },
      { name: '📝 Log Lab Usage', path: '/lab-inventory/use', roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT'] },
      { name: '⚖️ QC Queue', path: '/production/qc-queue', roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT', 'PRODUCTION_STAFF'], badgeKey: 'qcPending' },
      { name: '📦 Product Stock (Setup)', path: '/products/stock', roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT'] },
    ]
  },
  {
    id: 'rmStock',
    title: 'RM Stock',
    icon: Factory,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'],
    items: [
      { name: '🏬 RM Stock', path: '/rm/stock', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'] },
      { name: '⚠️ Low Stock', path: '/rm/stock/low', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'] },
      { name: '🔄 Stock Adjustment', path: '/rm/stock-adjustment/list', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'] },
    ]
  },
  {
    id: 'orders',
    title: 'Orders',
    icon: ShoppingCart,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM', 'LAB_ASSISTANT'],
    items: [
      { name: '📋 Order List', path: '/orders/list', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM', 'LAB_ASSISTANT'] },
      { name: '🚦 Order Status', path: '/orders/status', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM', 'LAB_ASSISTANT'] }
    ]
  },
  {
    id: 'forecasting',
    title: 'Forecasting',
    icon: TrendingUp,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM', 'LAB_ASSISTANT'],
    items: [
      { name: '📈 Forecast by Order', path: '/forecasting/by-order', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM', 'LAB_ASSISTANT'] },
      { name: '🔮 Forecast by Product', path: '/forecasting/by-product', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM', 'LAB_ASSISTANT'] }
    ]
  },
  {
    id: 'production',
    title: 'Production',
    icon: Factory,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'PRODUCTION_STAFF'],
    items: [
      { name: '⚙️ Production Batches', path: '/production/batches', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PRODUCTION_STAFF'] },
      { name: '📉 Production Loss', path: '/production/loss', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PRODUCTION_STAFF'] },
      { name: '📋 Loss Report', path: '/production/loss-report', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PRODUCTION_STAFF'] },
      { name: '🗑️ Product Wastage', path: '/production/wastage', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
    ]
  },
  {
    id: 'products',
    title: 'Products',
    icon: Layers,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM', 'LAB_ASSISTANT'],
    items: [
      { name: '📦 Product Stock', path: '/products/stock', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM', 'LAB_ASSISTANT'] },
      { name: '🚨 Low Stock Alerts', path: '/products/low-stock', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM', 'LAB_ASSISTANT'], badgeKey: 'lowStock' },
    ]
  },
  {
    id: 'finance',
    title: 'Finance',
    icon: DollarSign,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'],
    items: [
      { name: '💸 Expenses', path: '/finance/expenses', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'] },
      { name: '🏦 Accounts', path: '/finance/accounts', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'] },
    ]
  },
  {
    id: 'sales',
    title: 'Sales',
    icon: DollarSign,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'SALES_TEAM'],
    items: [
      { name: '📋 Sales & Invoices', path: '/sales/list', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'SALES_TEAM'] },
      { name: '↩️ Returns & Replacements', path: '/sales/return', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'SALES_TEAM'] },
      { name: '📊 Manager Analytics', path: '/sales/dashboard', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'SALES_TEAM'] },
    ]
  },
  {
    id: 'waste',
    title: 'Waste Management',
    icon: Archive,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT', 'PRODUCTION_STAFF'],
    items: [
      { name: '🗑️ RM Waste', path: '/waste/raw-material', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT', 'PRODUCTION_STAFF'] },
    ]
  },
  {
    id: 'parties',
    title: 'Parties',
    icon: Users,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'],
    items: [
      { name: '👥 Customer List', path: '/parties/customers', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'] },
      { name: '🤝 Supplier List', path: '/parties/suppliers', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'] },
    ]
  },
  {
    id: 'itemSetup',
    title: 'Item Setup',
    icon: Settings,
    roles: ['MAIN_MASTER', 'SUPERVISOR'],
    items: [
      { name: '🏷️ RM Category', path: '/setup/rm-category', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '🌾 Raw Material', path: '/setup/raw-material', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '🚫 Non Inventory', path: '/setup/non-inventory', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '🗂️ Product Category', path: '/setup/product-category', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '📦 Product', path: '/setup/product', roles: ['MAIN_MASTER', 'SUPERVISOR'] }
    ]
  },
  {
    id: 'system',
    title: 'System Config',
    icon: Settings,
    roles: ['MAIN_MASTER', 'SUPERVISOR'],
    items: [
      { name: '👥 User Management', path: '/admin/users', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '💸 Tax Settings', path: '/setup/tax', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '📋 Audit Log', path: '/audit-logs', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '🔔 Notification Audit', path: '/admin/notifications-audit', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: '💾 Database Backups', path: '/admin/backups', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
    ]
  }
];

const SIDEBAR_LAYOUT = [
  { type: 'group', id: 'dashboards' },
  { type: 'group', id: 'assetManagement' },
  { type: 'group', id: 'purchases' },
  { type: 'group', id: 'lab' },
  { type: 'group', id: 'rmStock' },
  { type: 'group', id: 'orders' },
  { type: 'group', id: 'forecasting' },
  { type: 'group', id: 'production' },
  { type: 'group', id: 'products' },
  { type: 'group', id: 'finance' },
  { type: 'group', id: 'sales' },
  { type: 'group', id: 'waste' },
  { type: 'group', id: 'parties' },
  { type: 'group', id: 'itemSetup' },
  { type: 'link', id: 'notifications' },
  { type: 'group', id: 'system' }
];

const AppShell = () => {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const navigate = useNavigate();
  const location = useLocation();

  const [expandedGroups, setExpandedGroups] = useState({});
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const { language, setLanguage } = useLanguageStore();

  const [lowStockCount, setLowStockCount] = useState(0);
  const [qcPendingCount, setQcPendingCount] = useState(0);
  const [attendanceStatus, setAttendanceStatus] = useState(null);

  // Collapsible and Search States for Sidebar
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'es', name: 'Español' },
    { code: 'ta', name: 'தமிழ்' }
  ];

  // Save Sidebar Collapsed State
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  // Fetch badge stats every 15s
  useEffect(() => {
    const fetchBadges = async () => {
      if (!token) return;
      try {
        const lowRes = await api.get('/products/low-stock');
        setLowStockCount(lowRes.data?.length || 0);
        
        const qcRes = await api.get('/production/qc-queue');
        setQcPendingCount(qcRes.data?.length || 0);
      } catch (e) {
        console.error('Failed to fetch sidebar badges', e);
      }
    };
    
    fetchBadges();
    const interval = setInterval(fetchBadges, 15000);
    return () => clearInterval(interval);
  }, [token]);

  // Fetch attendance status
  useEffect(() => {
    const fetchAttendanceStatus = async () => {
      if (!token) return;
      try {
        const res = await api.get('/attendance/status');
        setAttendanceStatus(res.data);
      } catch (e) {
        console.error('Failed to fetch attendance status', e);
      }
    };

    fetchAttendanceStatus();
    const interval = setInterval(fetchAttendanceStatus, 15000);
    return () => clearInterval(interval);
  }, [token, location.pathname]);

  // Initialize Dark Mode based on HTML class or local storage
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  // Sync Google Translate with Zustand store
  useEffect(() => {
    const applyLanguage = () => {
      const select = document.querySelector('.goog-te-combo');
      if (select) {
        select.value = language;
        select.dispatchEvent(new Event('change'));
      }
    };
    
    setTimeout(applyLanguage, 500);
  }, [language]);

  // Session verification
  useEffect(() => {
    if (!token || !user) {
      clearAuth();
      navigate('/login');
    }
  }, [token, user, clearAuth, navigate]);

  // Global search shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const activeItemPath = MENU_GROUPS
    .flatMap(group => group.items)
    .filter(item => location.pathname.startsWith(item.path))
    .reduce((longest, current) => 
      current.path.length > (longest?.path.length || 0) ? current : longest
    , null)?.path;

  const isItemActive = (path) => path === activeItemPath;

  // Auto-expand group if it contains the active route (accordion mode)
  useEffect(() => {
    let bestGroup = null;
    let maxLength = 0;

    MENU_GROUPS.forEach(group => {
      group.items.forEach(item => {
        if (location.pathname.startsWith(item.path) && item.path.length > maxLength) {
          maxLength = item.path.length;
          bestGroup = group;
        }
      });
    });

    if (bestGroup) {
      setExpandedGroups({ [bestGroup.id]: true });
    }
  }, [location.pathname]);

  // Sidebar Filter Logic based on search input
  const showDashboard = !sidebarSearch.trim() || 'dashboard'.toLowerCase().includes(sidebarSearch.toLowerCase());
  const showNotifications = !sidebarSearch.trim() || 'notifications center'.toLowerCase().includes(sidebarSearch.toLowerCase());

  const filteredMenuGroups = MENU_GROUPS.map((group) => {
    if (!group.roles.includes(user?.role)) return null;

    const visibleItems = group.items.filter(item => item.roles.includes(user?.role));
    if (visibleItems.length === 0) return null;

    if (!sidebarSearch.trim()) {
      return { ...group, filteredItems: visibleItems };
    }

    const searchLower = sidebarSearch.toLowerCase();
    const groupMatches = group.title.toLowerCase().includes(searchLower);
    const matchedItems = visibleItems.filter(item => 
      item.name.toLowerCase().includes(searchLower)
    );

    if (groupMatches) {
      return { ...group, filteredItems: visibleItems, forceExpand: true };
    } else if (matchedItems.length > 0) {
      return { ...group, filteredItems: matchedItems, forceExpand: true };
    }

    return null;
  }).filter(Boolean);

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-xl md:shadow-none
        transition-all duration-300 ease-in-out md:overflow-visible
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
        ${isSidebarCollapsed ? 'w-80 md:w-20' : 'w-80 md:w-80'}
      `}>
        
        {/* --- PREMIUM DESKTOP FLOATING TOGGLE BUTTON ---
            Placed exactly over the border dividing line (overlapping -right-3.5)
            and is perfectly styled with a white fill, slate border, high shadow, and centered arrow. */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          className="hidden md:flex absolute top-[50px] -right-3.5 z-[60] items-center justify-center w-7 h-7 rounded-full bg-white dark:bg-slate-900 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none"
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Sidebar Header Logo */}
        <div className="h-16 flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 transition-all duration-300 w-full overflow-hidden">
          {isSidebarCollapsed ? (
            <div className="w-full flex justify-center px-2">
              <button 
                onClick={() => setIsSidebarCollapsed(false)}
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all border border-indigo-100 dark:border-indigo-900/50 shadow-sm hover:shadow-indigo-500/10 group"
                title="Expand Sidebar"
              >
                <img 
                  src="/favicon.ico" 
                  onError={(e) => { e.target.src = "/favicon.svg"; }}
                  alt="ERP Logo" 
                  className="w-7 h-7 flex-shrink-0 group-hover:scale-110 transition-transform object-contain" 
                />
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between px-6">
              <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400 font-bold text-xl tracking-tight overflow-hidden">
                <img 
                  src="/favicon.ico" 
                  onError={(e) => { e.target.src = "/favicon.svg"; }}
                  alt="ERP Logo" 
                  className="w-7 h-7 flex-shrink-0 object-contain" 
                />
                <span className="transition-all duration-300 whitespace-nowrap bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
                  ERP
                </span>
              </div>
              
              {/* Mobile Close Button (Hidden on Desktop) */}
              <button className="md:hidden text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1 rounded-lg" onClick={() => setIsMobileMenuOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Search Input / Only displays when open */}
        {!isSidebarCollapsed && (
          <div className="mt-4 mb-2 px-4 w-full flex">
            <div className="relative flex items-center w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input 
                type="text" 
                value={sidebarSearch}
                onChange={e => setSidebarSearch(e.target.value)}
                placeholder="Search navigation..." 
                className="w-full bg-slate-50 hover:bg-slate-105 focus:bg-white dark:bg-slate-800 dark:hover:bg-slate-750 dark:focus:bg-slate-800 text-slate-750 dark:text-slate-200 placeholder-slate-400 text-sm rounded-xl pl-9 pr-8 py-2 border border-slate-200/60 dark:border-slate-755/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
              {sidebarSearch && (
                <button 
                  onClick={() => setSidebarSearch('')}
                  className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-205"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sidebar Navigation Links */}
        <nav className={`flex-1 py-4 scroll-smooth scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent ${
          isSidebarCollapsed ? 'md:overflow-visible' : 'overflow-y-auto'
        }`}>
          
          {SIDEBAR_LAYOUT.map((layoutItem) => {
            if (layoutItem.type === 'link') {
              if (layoutItem.id === 'dashboard') {
                return showDashboard && (
                  <div key="dashboard" className={`mb-2 w-full flex transition-all duration-300 ${isSidebarCollapsed ? 'justify-center px-2' : 'px-4'}`}>
                    <Link 
                      to="/dashboard" 
                      className={`flex items-center rounded-xl transition-all duration-200 group/btn relative ${
                        isSidebarCollapsed ? 'w-12 h-12 justify-center px-0' : 'w-full px-4 py-3 hover:translate-x-1'
                      } ${
                        location.pathname === '/dashboard' 
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 font-medium shadow-sm border border-indigo-100 dark:border-indigo-900/30' 
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
                      }`}
                      title={isSidebarCollapsed ? "Dashboard" : undefined}
                    >
                      <LayoutDashboard className={`w-5 h-5 flex-shrink-0 transition-colors ${
                        isSidebarCollapsed ? '' : 'mr-3'
                      } ${location.pathname === '/dashboard' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 group-hover/btn:text-indigo-500'}`} />
                      
                      <span className={`transition-all duration-300 text-left font-medium whitespace-nowrap overflow-hidden text-ellipsis ${
                        isSidebarCollapsed ? 'w-0 opacity-0' : 'w-full opacity-100'
                      }`}>
                        Dashboard
                      </span>

                      {/* Subtle active indicator dot in collapsed mode */}
                      {isSidebarCollapsed && location.pathname === '/dashboard' && (
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-650 dark:bg-indigo-400 shadow-sm" />
                      )}
                    </Link>
                  </div>
                );
              }
              if (layoutItem.id === 'notifications') {
                return showNotifications && (
                  <div key="notifications" className={`mb-3 w-full flex transition-all duration-300 ${isSidebarCollapsed ? 'justify-center px-2' : 'px-4'}`}>
                    <Link 
                      to="/notifications" 
                      className={`flex items-center rounded-xl transition-all duration-200 group/btn relative ${
                        isSidebarCollapsed ? 'w-12 h-12 justify-center px-0' : 'w-full px-4 py-3 hover:translate-x-1'
                      } ${
                        location.pathname === '/notifications' 
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 font-medium shadow-sm border border-indigo-100 dark:border-indigo-900/30' 
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
                      }`}
                      title={isSidebarCollapsed ? "Notifications Center" : undefined}
                    >
                      <Bell className={`w-5 h-5 flex-shrink-0 transition-colors ${
                        isSidebarCollapsed ? '' : 'mr-3'
                      } ${location.pathname === '/notifications' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 group-hover/btn:text-indigo-500'}`} />
                      
                      <span className={`transition-all duration-300 text-left font-medium whitespace-nowrap overflow-hidden text-ellipsis ${
                        isSidebarCollapsed ? 'w-0 opacity-0' : 'w-full opacity-100'
                      }`}>
                        Notifications Center
                      </span>

                      {/* Subtle active indicator dot in collapsed mode */}
                      {isSidebarCollapsed && location.pathname === '/notifications' && (
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-650 dark:bg-indigo-400 shadow-sm" />
                      )}
                    </Link>
                  </div>
                );
              }
              return null;
            }

            const group = filteredMenuGroups.find((g) => g.id === layoutItem.id);
            if (!group) return null;

            const isExpanded = expandedGroups[group.id] || group.forceExpand;
            const GroupIcon = group.icon;
            const visibleItems = group.filteredItems;
            const hasActiveChild = visibleItems.some(item => isItemActive(item.path));

            return (
              <div key={group.id} className={`mb-2 relative w-full flex flex-col transition-all duration-300 group/menu ${isSidebarCollapsed ? 'items-center px-2' : 'px-4'}`}>
                {/* The main group toggle button */}
                <button
                  onClick={() => {
                    if (isSidebarCollapsed) {
                      setIsSidebarCollapsed(false);
                      setExpandedGroups({ [group.id]: true });
                    } else {
                      toggleGroup(group.id);
                    }
                  }}
                  className={`flex items-center rounded-xl transition-all duration-300 group/btn relative ${
                    isSidebarCollapsed ? 'w-12 h-12 justify-center px-0' : 'w-full px-4 py-3'
                  } ${
                    isExpanded && !isSidebarCollapsed ? 'bg-slate-50 dark:bg-slate-800/50' : ''
                  } ${
                    hasActiveChild
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 font-medium border border-indigo-100 dark:border-indigo-900/30'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
                  }`}
                  title={isSidebarCollapsed ? group.title : undefined}
                >
                  <GroupIcon className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${
                    isSidebarCollapsed ? '' : 'mr-3'
                  } ${
                    isExpanded && !isSidebarCollapsed ? 'text-indigo-500 scale-110' : 'text-slate-400 group-hover/btn:text-indigo-500'
                  }`} />
                  
                  {/* Animated Text Label */}
                  <span className={`transition-all duration-300 text-left font-medium whitespace-nowrap overflow-hidden text-ellipsis ${
                    isSidebarCollapsed ? 'w-0 opacity-0' : 'w-full opacity-100'
                  }`}>
                    {group.title}
                  </span>

                  {/* Animated Plus/Minus Chevron Toggle */}
                  <div className={`transition-all duration-300 flex items-center justify-center p-1 rounded-md ${
                    isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100 ml-2'
                  } ${isExpanded ? 'bg-indigo-100 dark:bg-indigo-500/20' : ''}`}>
                    {isExpanded ? (
                      <Minus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                    )}
                  </div>

                  {/* Subtle active indicator dot in collapsed mode if has active children */}
                  {isSidebarCollapsed && hasActiveChild && (
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-650 dark:bg-indigo-400 shadow-sm" />
                  )}
                </button>

                {/* Expanded State Collapsible Items (Accordion style) */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out w-full ${
                  isExpanded && !isSidebarCollapsed ? 'max-h-[2000px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0 pointer-events-none'
                }`}>
                  <div className="ml-6 pl-4 border-l-2 border-slate-100 dark:border-slate-800 space-y-1 py-1">
                    {visibleItems.map((item) => {
                      const active = isItemActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`flex items-center justify-between px-4 py-2.5 text-sm rounded-lg transition-all duration-200 relative ${
                            active 
                              ? 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 font-semibold shadow-sm' 
                              : 'text-slate-550 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-205 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 hover:translate-x-1'
                          }`}
                        >
                          <div className="flex items-center">
                            {active && (
                              <span className="absolute left-[-17px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900" />
                            )}
                            <span>{item.name}</span>
                          </div>
                          {item.badgeKey && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.badgeKey === 'lowStock' 
                                ? 'bg-rose-500 text-white dark:bg-rose-500/20 dark:text-rose-404' 
                                : 'bg-amber-550 text-white dark:bg-amber-500/20 dark:text-amber-404'
                            }`}>
                              {item.badgeKey === 'lowStock' ? lowStockCount : qcPendingCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Collapsed State Hover Menu (Floating Submenu overlay) */}
                {isSidebarCollapsed && (
                  <div className="absolute left-full top-0 ml-3 w-60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-850 rounded-2xl shadow-xl py-2 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200 z-[100] transform translate-x-2 group-hover/menu:translate-x-0 border-l-4 border-l-indigo-500/80">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-1.5 flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider">{group.title}</span>
                      <GroupIcon className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="max-h-80 overflow-y-auto py-1 px-2 space-y-1 scrollbar-thin">
                      {visibleItems.map((item) => {
                        const active = isItemActive(item.path);
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
                              active
                                ? 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 font-semibold shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <span>{item.name}</span>
                            {item.badgeKey && (
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                item.badgeKey === 'lowStock'
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-amber-500 text-white'
                              }`}>
                                {item.badgeKey === 'lowStock' ? lowStockCount : qcPendingCount}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        </nav>
      </aside>

      {/* --- Main Content Wrapper --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* --- Top Header --- */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-40">
          
          <div className="flex items-center">
            <button 
              className="md:hidden mr-4 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 hidden sm:block">
              {/* Dynamic Page Title could go here */}
            </h2>
          </div>

          {/* Header Right Actions */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            
            {/* Global Search Button */}
            <button 
              onClick={() => setShowSearch(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-sm transition-colors w-64 border border-transparent focus:border-indigo-400"
            >
              <Search className="w-4 h-4" />
              <span className="flex-1 text-left">Search anything...</span>
              <kbd className="text-[10px] font-sans px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">Ctrl+K</kbd>
            </button>

            {/* Mobile Global Search Button (Icon only) */}
            <button 
              type="button"
              onClick={() => setShowSearch(true)}
              className="md:hidden p-2 text-slate-500 hover:bg-slate-105 dark:hover:bg-slate-800 rounded-full transition-colors"
              title="Search anything..."
            >
              <Search className="w-5 h-5" />
            </button>

            {/* QR Scan Button / Drop Zone */}
            <button 
              onClick={() => setShowQRScanner(true)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const text = e.dataTransfer.getData('text/plain');
                if (text) {
                  navigate(`/qr-lifecycle/${encodeURIComponent(text)}`);
                }
              }}
              className="p-2 text-slate-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-650 dark:hover:text-indigo-400 rounded-full transition-colors relative group border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30"
              title="Scan QR Code (or Drag & Drop QR code here to scan!)"
            >
              <ScanLine className="w-5 h-5 group-hover:scale-110 transition-transform text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
              <span className="absolute bottom-1 right-1 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
              </span>
            </button>

            {/* Check In/Out Button */}
            <Link 
              to="/attendance" 
              className={`flex items-center p-2 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-md text-sm font-medium transition-colors relative ${
                attendanceStatus?.isCheckedIn
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-650 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 border border-emerald-250/20'
                  : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-transparent'
              }`}
              title={attendanceStatus?.isCheckedIn ? "Live Session — Checked In" : "Checked Out — Click to Check In/Out"}
            >
              <Clock className={`w-5 h-5 sm:w-4 sm:h-4 sm:mr-2 ${attendanceStatus?.isCheckedIn ? 'text-emerald-500 animate-pulse' : 'text-slate-550 group-hover:text-indigo-650'}`} />
              <span className="hidden sm:inline">Check In/Out</span>
              {attendanceStatus?.isCheckedIn && (
                <span className="absolute top-1.5 right-1.5 sm:top-1 sm:right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </Link>

            {/* Language Selector */}
            <div className="relative">
              <button 
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="hidden lg:flex items-center text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2"
              >
                {languages.find(l => l.code === language)?.name || 'English'}
                <ChevronDown className="w-4 h-4 ml-1" />
              </button>
              {showLanguageMenu && (
                <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setShowLanguageMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        language === lang.code 
                          ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 font-medium' 
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block mx-1"></div>

            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications */}
            <NotificationBell />

            {/* User Profile Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-650 dark:text-indigo-305 flex items-center justify-center font-bold text-sm overflow-hidden border border-indigo-200 dark:border-indigo-700">
                  {user?.profilePhoto ? (
                    <img src={user.profilePhoto} alt={user?.name} className="w-full h-full object-cover" />
                  ) : (
                    user?.name?.substring(0, 2).toUpperCase() || 'U'
                  )}
                </div>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 mb-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{user?.role?.replace(/_/g, ' ')}</p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setShowProfileMenu(false)}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-305 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center transition-colors"
                  >
                    <User className="w-4 h-4 mr-2" /> Change Profile
                  </Link>
                  <Link
                    to="/change-password"
                    onClick={() => setShowProfileMenu(false)}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-305 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center transition-colors"
                  >
                    <Settings className="w-4 h-4 mr-2" /> Change Password
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 mt-1 text-sm text-red-650 dark:text-red-404 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center transition-colors border-t border-slate-100 dark:border-slate-700"
                  >
                    <LogOut className="w-4 h-4 mr-2" /> Sign out
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* --- Main Content Area --- */}
        <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900/50 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* Global Search Modal */}
      {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScannerModal 
          onClose={() => setShowQRScanner(false)} 
          onScan={(text) => {
            setShowQRScanner(false);
            navigate(`/qr-lifecycle/${encodeURIComponent(text)}`);
          }} 
        />
      )}
    </div>
  );
};

export default AppShell;
