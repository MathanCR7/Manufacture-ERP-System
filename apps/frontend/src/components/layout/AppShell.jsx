import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '@/app/store/authStore';
import { 
  LayoutDashboard, ShoppingCart, FlaskConical, Factory, 
  DollarSign, Settings, Bell, Moon, Sun, Clock, 
  User, LogOut, ChevronDown, ChevronRight, Plus, Minus,
  Menu, X, Users
} from 'lucide-react';

// --- Menu Configuration based on Permissions Matrix ---
const MENU_GROUPS = [
  {
    id: 'procurement',
    title: 'Procurement',
    icon: ShoppingCart,
    roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER'],
    items: [
      { name: 'Purchase Orders', path: '/purchase-orders', roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER'] },
      { name: 'GRN', path: '/grn', roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'] },
      { name: 'RM Stock', path: '/rm/stock', roles: ['MAIN_MASTER', 'MATERIALS_RECEIVER'] },
      { name: 'RM Wastage', path: '/rm/wastage', roles: ['MAIN_MASTER', 'MATERIALS_RECEIVER'] },
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
      { name: 'Product List', path: '/setup/product', roles: ['MAIN_MASTER', 'SUPERVISOR'] }
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
    ]
  }
];

const AppShell = () => {
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const navigate = useNavigate();
  const location = useLocation();

  const [expandedGroups, setExpandedGroups] = useState({});
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Initialize Dark Mode based on HTML class (assuming Tailwind dark mode class strategy)
  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) {
      setIsDarkMode(true);
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
            
            {/* Check In/Out Button */}
            <button className="hidden sm:flex items-center px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-md text-sm font-medium transition-colors">
              <Clock className="w-4 h-4 mr-2" />
              Check In/Out
            </button>

            {/* Language Selector (Placeholder) */}
            <button className="hidden lg:flex items-center text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2">
              English
              <ChevronDown className="w-4 h-4 ml-1" />
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block mx-1"></div>

            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications */}
            <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900"></span>
            </button>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-sm">
                  {user?.name?.substring(0, 2).toUpperCase() || 'U'}
                </div>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.role?.replace('_', ' ')}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
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
    </div>
  );
};

export default AppShell;
