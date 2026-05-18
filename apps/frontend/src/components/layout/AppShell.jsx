import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '@/app/store/authStore';
import { 
  LayoutDashboard, ShoppingCart, FlaskConical, Factory, 
  DollarSign, Settings, Moon, Sun, Clock, 
  User, LogOut, ChevronDown, ChevronRight, Plus, Minus,
  Menu, X, Users, Archive, Search, QrCode, ScanLine, XCircle, FileText
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import useLanguageStore from '@/app/store/languageStore';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '@/lib/axios';

const GlobalSearch = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

  const categories = results ? Object.entries(results).filter(([_, items]) => items.length > 0) : [];

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
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{item.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
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
  useEffect(() => {
    const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    scanner.render((text) => {
      scanner.clear();
      onScan(text);
    }, (err) => { /* ignore */ });
    return () => scanner.clear().catch(e => console.error(e));
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex justify-center items-center px-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-500" /> Scan QR Code
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        <div id="reader" className="w-full bg-black rounded-xl overflow-hidden border-2 border-indigo-500/30"></div>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">Point your camera at the ERP QR code</p>
      </div>
    </div>
  );
};

// --- Menu Configuration based on Permissions Matrix ---
const MENU_GROUPS = [
  {
    id: 'purchases',
    title: 'Purchases',
    icon: ShoppingCart,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER'],
    items: [
      { name: 'Add Purchase', path: '/purchase-orders/create', roles: ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'] },
      { name: 'Purchase List', path: '/purchase-orders', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER'] },
      { name: 'Upcoming Deliveries', path: '/grn/upcoming', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'] },
      { name: 'GRN Records', path: '/grn/list', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT'] },
      { name: 'Add Purchase Return', path: '/purchase-return/add', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT'] },
      { name: 'Purchase Returns', path: '/purchase-return/list', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT'] },
    ]
  },
  {
    id: 'rmStock',
    title: 'RM Stock',
    icon: Factory,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'],
    items: [
      { name: 'RM Stock', path: '/rm/stock', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'] },
      { name: 'Low Stock', path: '/rm/stock/low', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'] },
    ]
  },
  {
    id: 'inventory',
    title: 'Inventory',
    icon: Archive,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'],
    items: [
      { name: 'Upload to Inventory', path: '/inventory/upload', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'] },
      { name: 'Inventory Batches', path: '/inventory/list', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'] },
    ]
  },
  {
    id: 'sales',
    title: 'Sales',
    icon: DollarSign,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'],
    items: [
      { name: 'Add Sale', path: '/sales/add', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'] },
      { name: 'Sale List', path: '/sales/list', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'] },
      { name: 'Add Sale Return', path: '/sales/return/add', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'] },
      { name: 'Sale Return List', path: '/sales/return/list', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'] },
    ]
  },
  {
    id: 'lab',
    title: 'Lab Testing',
    icon: FlaskConical,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT'],
    items: [
      { name: 'Pending RM Lab Tests', path: '/lab/pending', roles: ['MAIN_MASTER', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT'] },
      { name: 'RM Lab Results', path: '/lab/results', roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT'] },
      { name: 'RM Lab Category', path: '/lab/rm-lab-category', roles: ['MAIN_MASTER', 'LAB_ASSISTANT'] },
      { name: 'RM Required Lab Results', path: '/lab/rm-required-results', roles: ['MAIN_MASTER', 'LAB_ASSISTANT'] },
      { name: 'Lab Inventory', path: '/lab-inventory/list', roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT'] },
      { name: 'Add Lab Item', path: '/lab-inventory/add', roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT'] },
      { name: 'Log Lab Usage', path: '/lab-inventory/use', roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT'] },
      { name: 'Production QC Queue', path: '/production/qc-queue', roles: ['MAIN_MASTER', 'LAB_ASSISTANT'] },
    ]
  },
  {
    id: 'production',
    title: 'Production',
    icon: Factory,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT'],
    items: [
      { name: 'Production Batches', path: '/production/batches', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: 'Product Stock', path: '/product/stock', roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT'] },
      { name: 'Product Wastage', path: '/production/wastage', roles: ['MAIN_MASTER'] },
    ]
  },
  {
    id: 'finance',
    title: 'Finance',
    icon: DollarSign,
    roles: ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'],
    items: [
      { name: 'Expenses', path: '/finance/expenses', roles: ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'] },
      { name: 'Accounts', path: '/finance/accounts', roles: ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'] },
    ]
  },
  {
    id: 'parties',
    title: 'Parties',
    icon: Users,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'],
    items: [
      { name: 'Add Customer', path: '/parties/customers/add', roles: ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'] },
      { name: 'Customer List', path: '/parties/customers', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'] },
      { name: 'Add Supplier', path: '/parties/suppliers/add', roles: ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'] },
      { name: 'Supplier List', path: '/parties/suppliers', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'] },
    ]
  },
  {
    id: 'itemSetup',
    title: 'Item Setup',
    icon: Settings,
    roles: ['MAIN_MASTER', 'SUPERVISOR'],
    items: [
      { name: 'Add RM Category', path: '/setup/rm-category/add', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: 'RM Category List', path: '/setup/rm-category', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: 'Add Raw Material', path: '/setup/raw-material/add', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: 'Raw Material List', path: '/setup/raw-material', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: 'Add Non Inventory Item', path: '/setup/non-inventory/add', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: 'Non Inventory Item List', path: '/setup/non-inventory', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: 'Add Product Category', path: '/setup/product-category/add', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: 'Product Category List', path: '/setup/product-category', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: 'Add Product', path: '/setup/product/add', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: 'Product List', path: '/setup/product', roles: ['MAIN_MASTER', 'SUPERVISOR'] },
      { name: 'Categories', path: '/setup/categories', roles: ['MAIN_MASTER', 'SUPERVISOR'] }
    ]
  },
  {
    id: 'waste',
    title: 'Waste Management',
    icon: Archive,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT', 'MATERIALS_RECEIVER', 'PRODUCTION_STAFF'],
    items: [
      { name: 'RM Waste', path: '/waste/raw-material', roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT', 'MATERIALS_RECEIVER', 'PRODUCTION_STAFF'] },
      { name: 'Add RM Waste', path: '/waste/raw-material/add', roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT', 'MATERIALS_RECEIVER', 'PRODUCTION_STAFF'] },
    ]
  },
  {
    id: 'system',
    title: 'System Config',
    icon: Settings,
    roles: ['MAIN_MASTER'],
    items: [
      { name: 'User Management', path: '/admin/users', roles: ['MAIN_MASTER'] },
      { name: 'Audit Log', path: '/audit-logs', roles: ['MAIN_MASTER'] },
      { name: 'Notification Audit', path: '/admin/notifications-audit', roles: ['MAIN_MASTER'] },
    ]
  }
];

const AppShell = () => {
  const user = useAuthStore((state) => state.user);
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

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'es', name: 'Español' },
    { code: 'ta', name: 'தமிழ்' }
  ];

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
    
    // Slight delay to ensure widget is loaded if it's the first time
    setTimeout(applyLanguage, 500);
  }, [language]);

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

  const isItemActive = (path) => location.pathname.startsWith(path);

  // Auto-expand group if it contains the active route
  useEffect(() => {
    const currentGroup = MENU_GROUPS.find(group => 
      group.items.some(item => location.pathname.startsWith(item.path))
    );
    if (currentGroup) {
      setExpandedGroups(prev => ({ ...prev, [currentGroup.id]: true }));
    }
  }, [location.pathname]);

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      
      {/* --- Sidebar --- */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out flex flex-col shadow-xl md:shadow-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        {/* Sidebar Header Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3 text-indigo-600 dark:text-indigo-400 font-bold text-xl tracking-tight">
            <Factory className="w-7 h-7" />
            <span>Manufacture ERP</span>
          </div>
          <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4 scroll-smooth scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
          
          {/* Dashboard Link (Always visible to all) */}
          <div className="px-4 mb-3">
            <Link 
              to="/dashboard" 
              className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${
                location.pathname === '/dashboard' 
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 font-medium shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 hover:translate-x-1'
              }`}
            >
              <LayoutDashboard className={`w-5 h-5 mr-3 transition-colors ${location.pathname === '/dashboard' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-500'}`} />
              <span className="flex-1">Dashboard</span>
            </Link>
          </div>

          {/* Dynamic Menu Groups based on Roles */}
          {MENU_GROUPS.map((group) => {
            // Check if user role is allowed in this group
            if (!group.roles.includes(user?.role)) return null;

            // Filter items user is allowed to see
            const visibleItems = group.items.filter(item => item.roles.includes(user?.role));
            if (visibleItems.length === 0) return null;

            const isExpanded = expandedGroups[group.id];
            const GroupIcon = group.icon;

            return (
              <div key={group.id} className="px-4 mb-2">
                {/* Parent Category Button */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl transition-all duration-200 group ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}
                >
                  <GroupIcon className={`w-5 h-5 mr-3 transition-colors ${isExpanded ? 'text-indigo-500' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                  <span className="flex-1 text-left font-medium">{group.title}</span>
                  <div className={`p-1 rounded-md transition-colors ${isExpanded ? 'bg-indigo-100 dark:bg-indigo-500/20' : ''}`}>
                    {isExpanded ? (
                      <Minus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                    )}
                  </div>
                </button>

                {/* Collapsible Sub-items */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
                  <div className="ml-6 pl-4 border-l-2 border-slate-100 dark:border-slate-800 space-y-1 py-1">
                    {visibleItems.map((item) => {
                      const active = isItemActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`block px-4 py-2.5 text-sm rounded-lg transition-all duration-200 relative ${
                            active 
                              ? 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 font-semibold' 
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:translate-x-1'
                          }`}
                        >
                          {active && (
                            <span className="absolute left-[-17px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900" />
                          )}
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

        </nav>
      </aside>

      {/* --- Main Content Wrapper --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
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
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-sm transition-colors w-64 border border-transparent focus:border-indigo-400"
            >
              <Search className="w-4 h-4" />
              <span className="flex-1 text-left">Search anything...</span>
              <kbd className="text-[10px] font-sans px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">Ctrl+K</kbd>
            </button>

            {/* QR Scan Button */}
            <button 
              onClick={() => setShowQRScanner(true)}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors hidden sm:block"
              title="Scan QR Code"
            >
              <ScanLine className="w-5 h-5" />
            </button>

            {/* Check In/Out Button */}
            <Link 
              to="/attendance" 
              className="hidden sm:flex items-center px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-md text-sm font-medium transition-colors"
            >
              <Clock className="w-4 h-4 mr-2" />
              Check In/Out
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
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-sm overflow-hidden border border-indigo-200 dark:border-indigo-700">
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
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center transition-colors"
                  >
                    <User className="w-4 h-4 mr-2" /> Change Profile
                  </Link>
                  <Link
                    to="/change-password"
                    onClick={() => setShowProfileMenu(false)}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center transition-colors"
                  >
                    <Settings className="w-4 h-4 mr-2" /> Change Password
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 mt-1 text-sm text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center transition-colors border-t border-slate-100 dark:border-slate-700"
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
