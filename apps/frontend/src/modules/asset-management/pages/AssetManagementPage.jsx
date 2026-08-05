import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '@/app/store/authStore';
import { 
  FileText, ShoppingBag, ClipboardList, PackageCheck, 
  Receipt, Landmark, BarChart3, AlertTriangle, HardDrive
} from 'lucide-react';

// Views
import PurchaseRequestsView from '../components/PurchaseRequestsView';
import PurchaseQuotationsView from '../components/PurchaseQuotationsView';
import PurchaseOrdersView from '../components/PurchaseOrdersView';
import GRPOView from '../components/GRPOView';
import APInvoiceView from '../components/APInvoiceView';
import AssetRegisterView from '../components/AssetRegisterView';
import ReportsView from '../components/ReportsView';

export default function AssetManagementPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  
  // Determine active tab from URL path
  const getTabFromPath = (path) => {
    if (path.includes('/requests')) return 'requests';
    if (path.includes('/quotations')) return 'quotations';
    if (path.includes('/orders')) return 'orders';
    if (path.includes('/grpo')) return 'grpo';
    if (path.includes('/invoice')) return 'invoice';
    if (path.includes('/register')) return 'register';
    if (path.includes('/reports')) return 'reports';
    return 'requests';
  };

  const activeTab = getTabFromPath(location.pathname);

  const handleTabChange = (tabId) => {
    navigate(`/asset-management/${tabId}`);
  };

  const tabs = [
    { id: 'requests', label: 'Requests', icon: FileText },
    { id: 'quotations', label: 'Quotations', icon: ShoppingBag },
    { id: 'orders', label: 'Orders', icon: ClipboardList },
    { id: 'grpo', label: 'GRPO', icon: PackageCheck },
    { id: 'invoice', label: 'AP Invoice', icon: Receipt },
    { id: 'register', label: 'Register', icon: Landmark },
    { id: 'reports', label: 'Reports', icon: BarChart3 }
  ];

  // Render the selected subview
  const renderActiveView = () => {
    switch (activeTab) {
      case 'requests':
        return <PurchaseRequestsView />;
      case 'quotations':
        return <PurchaseQuotationsView />;
      case 'orders':
        return <PurchaseOrdersView />;
      case 'grpo':
        return <GRPOView />;
      case 'invoice':
        return <APInvoiceView />;
      case 'register':
        return <AssetRegisterView />;
      case 'reports':
        return <ReportsView />;
      default:
        return <PurchaseRequestsView />;
    }
  };

  return (
    <div className="p-0 space-y-6 w-full max-w-[100%] min-h-screen">
      {/* Top Banner indicating read-only mode for Supervisors */}
      {user?.role === 'SUPERVISOR' && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-medium animate-in fade-in slide-in-from-top-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You are logged in as a <strong>Supervisor</strong>. You have <strong>Read-Only access</strong> to the Asset Management module. All actions, additions, and edits are disabled.</span>
        </div>
      )}

      {/* Module Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
              <HardDrive className="w-6 h-6 sm:w-7 h-7" />
            </div>
            Asset Management
          </h1>
        </div>
      </div>

      {/* Tabs Navigation Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-1.5 shadow-sm overflow-x-auto scrollbar-none flex gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 active:scale-[0.98] ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Subview Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-sm min-h-[500px] transition-all">
        {renderActiveView()}
      </div>
    </div>
  );
}
