import React, { Component, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/guards/ProtectedRoute';
import RoleGuard from '@/components/guards/RoleGuard';
import AppShell from '@/components/layout/AppShell';
import { RotateCw, AlertCircle } from 'lucide-react';
import useAuthStore, { getRedirectPathByRole } from '@/app/store/authStore';

const LoginPage = lazy(() => import('@/modules/auth/pages/LoginPage'));
const UserRolePage = lazy(() => import('@/modules/admin/pages/UserRolePage'));
const UserManagementPage = lazy(() => import('@/modules/admin/pages/UserManagementPage'));

const POListPage = lazy(() => import('@/modules/purchase/pages/POListPage'));
const CreatePOPage = lazy(() => import('@/modules/purchase/pages/CreatePOPage'));
const EditPOPage = lazy(() => import('@/modules/purchase/pages/EditPOPage'));
const PODetailPage = lazy(() => import('@/modules/purchase/pages/PODetailPage'));
const RMQuotationPage = lazy(() => import('@/modules/purchase/pages/RMQuotationPage'));
const SupplierQuotationPublicPage = lazy(() => import('@/modules/purchase/pages/SupplierQuotationPublicPage'));
const AssetQuotationPublicPage = lazy(() => import('@/modules/asset-management/pages/AssetQuotationPublicPage'));
const RMStockPage = lazy(() => import('@/modules/purchase/pages/RMStockPage'));
const RMLowStockPage = lazy(() => import('@/modules/purchase/pages/RMLowStockPage'));
const PurchaseReturnAddPage = lazy(() => import('@/modules/purchase/pages/PurchaseReturnAddPage'));
const PurchaseReturnListPage = lazy(() => import('@/modules/purchase/pages/PurchaseReturnListPage'));
const StockAdjustmentAddPage = lazy(() => import('@/modules/purchase/pages/StockAdjustmentAddPage'));
const StockAdjustmentListPage = lazy(() => import('@/modules/purchase/pages/StockAdjustmentListPage'));

const DashboardPage = lazy(() => import('@/modules/dashboard/pages/DashboardPage'));
const ExecutiveDashboardPage    = lazy(() => import('@/modules/dashboard/pages/ExecutiveDashboardPage'));
const SalesDashboardPage        = lazy(() => import('@/modules/dashboard/pages/SalesDashboardPage'));
const ProductionDashboardPage   = lazy(() => import('@/modules/dashboard/pages/ProductionDashboardPage'));
const InventoryDashboardPage    = lazy(() => import('@/modules/dashboard/pages/InventoryDashboardPage'));
const FinanceDashboardPage      = lazy(() => import('@/modules/dashboard/pages/FinanceDashboardPage'));
const HRDashboardPage           = lazy(() => import('@/modules/dashboard/pages/HRDashboardPage'));
const MaintenanceDashboardPage  = lazy(() => import('@/modules/dashboard/pages/MaintenanceDashboardPage'));
const LabDashboardPage          = lazy(() => import('@/modules/dashboard/pages/LabDashboardPage'));

// Parties Module
const CustomerListPage = lazy(() => import('@/modules/parties/pages/CustomerListPage'));
const AddCustomerPage = lazy(() => import('@/modules/parties/pages/AddCustomerPage'));
const SupplierListPage = lazy(() => import('@/modules/parties/pages/SupplierListPage'));
const AddSupplierPage = lazy(() => import('@/modules/parties/pages/AddSupplierPage'));

// Item Setup Module
const RMCategoryListPage = lazy(() => import('@/modules/item-setup/pages/RMCategoryListPage'));
const RawMaterialListPage = lazy(() => import('@/modules/item-setup/pages/RawMaterialListPage'));
const NonInventoryItemListPage = lazy(() => import('@/modules/item-setup/pages/NonInventoryItemListPage'));
const ProductCategoryListPage = lazy(() => import('@/modules/item-setup/pages/ProductCategoryListPage'));
const ProductListPage = lazy(() => import('@/modules/item-setup/pages/ProductListPage'));
const TaxSettingsPage = lazy(() => import('@/modules/item-setup/pages/TaxSettingsPage'));

const AuditLogListPage = lazy(() => import('@/modules/admin/pages/AuditLogListPage'));
const NotificationAuditPanel = lazy(() => import('@/modules/admin/pages/NotificationAuditPanel'));
const BackupListPage = lazy(() => import('@/modules/admin/pages/BackupListPage'));
const NotificationsListPage = lazy(() => import('@/modules/admin/pages/NotificationsListPage'));

const RMWasteListPage = lazy(() => import('@/modules/waste/pages/RMWasteListPage'));
const CreateRMWastePage = lazy(() => import('@/modules/waste/pages/CreateRMWastePage'));

// GRN Module
const UpcomingDeliveriesPage = lazy(() => import('@/modules/grn/pages/UpcomingDeliveriesPage'));
const ReceiveDeliveryPage = lazy(() => import('@/modules/grn/pages/ReceiveDeliveryPage'));
const GRNViewPage = lazy(() => import('@/modules/grn/pages/GRNViewPage'));
const GRNListPage = lazy(() => import('@/modules/grn/pages/GRNListPage'));

// Lab Module
const PendingLabTestsPage = lazy(() => import('@/modules/lab/pages/PendingLabTestsPage'));
const LabTestPage = lazy(() => import('@/modules/lab/pages/LabTestPage'));
const LabResultsPage = lazy(() => import('@/modules/lab/pages/LabResultsPage'));
const LabInventoryListPage = lazy(() => import('@/modules/lab/pages/LabInventoryListPage'));
const LabInventoryAddPage = lazy(() => import('@/modules/lab/pages/LabInventoryAddPage'));
const LabInventoryUsagePage = lazy(() => import('@/modules/lab/pages/LabInventoryUsagePage'));

// NEW: RM Lab Category & Required Results
const RMLabCategoryPage = lazy(() => import('@/modules/lab/pages/RMLabCategoryPage'));

// Shared
const ChangeProfilePage = lazy(() => import('@/modules/shared/pages/ChangeProfilePage'));
const ChangePasswordPage = lazy(() => import('@/modules/shared/pages/ChangePasswordPage'));
const CheckInOutPage = lazy(() => import('@/modules/shared/pages/CheckInOutPage'));
const QRLifecyclePage = lazy(() => import('@/modules/shared/pages/QRLifecyclePage'));

// Inventory Module
const InventoryUploadPage = lazy(() => import('@/modules/inventory/pages/InventoryUploadPage'));

// Production Module Pages
const ProductStockPage = lazy(() => import('@/modules/production/pages/ProductStockPage'));
const LowStockAlertsPage = lazy(() => import('@/modules/production/pages/LowStockAlertsPage'));
const ProductionsPage = lazy(() => import('@/modules/production/pages/ProductionsPage'));
const AddProductionPage = lazy(() => import('@/modules/production/pages/AddProductionPage'));

// Sales Module Pages
const SalesListPage = lazy(() => import('@/modules/sales/pages/SalesListPage'));
const SalesReturnsPage = lazy(() => import('@/modules/sales/pages/SalesReturnsPage'));
const SalesDashboard = lazy(() => import('@/modules/sales/pages/SalesDashboard'));
const ProductionLossPage = lazy(() => import('@/modules/production/pages/ProductionLossPage'));
const LossReportPage = lazy(() => import('@/modules/production/pages/LossReportPage'));
const QCQueuePage = lazy(() => import('@/modules/production/pages/QCQueuePage'));
const ProductWastagePage = lazy(() => import('@/modules/production/pages/ProductWastagePage'));

// Customer Order Module Pages
const AddOrderPage = lazy(() => import('@/modules/production/pages/AddOrderPage'));
const OrderListPage = lazy(() => import('@/modules/production/pages/OrderListPage'));
const OrderStatusPage = lazy(() => import('@/modules/production/pages/OrderStatusPage'));

// Forecasting Module Pages
const StockForecastingPage = lazy(() => import('@/modules/forecasting/pages/StockForecastingPage'));
const WorkforceForecastingPage = lazy(() => import('@/modules/forecasting/pages/WorkforceForecastingPage'));
const CashFlowForecastingPage = lazy(() => import('@/modules/forecasting/pages/CashFlowForecastingPage'));
const VendorForecastingPage = lazy(() => import('@/modules/forecasting/pages/VendorForecastingPage'));
const ProductionYieldForecastingPage = lazy(() => import('@/modules/forecasting/pages/ProductionYieldForecastingPage'));
const WhatIfForecastingPage = lazy(() => import('@/modules/forecasting/pages/WhatIfForecastingPage'));
const ReturnsForecastingPage = lazy(() => import('@/modules/forecasting/pages/ReturnsForecastingPage'));
const PredictiveForecastingHubPage = lazy(() => import('@/modules/forecasting/pages/PredictiveForecastingHubPage'));

// Operations Calendar Module Pages
const OperationsCalendarPage = lazy(() => import('@/modules/calendar/pages/OperationsCalendarPage'));

// Asset Management Module
const AssetManagementPage = lazy(() => import('@/modules/asset-management/pages/AssetManagementPage'));

// Finance Module
const ExpensesPage = lazy(() => import('@/modules/finance/pages/ExpensesPage'));

// Reports & Analytics Module Pages
const RMConsumptionReportPage = lazy(() => import('@/pages/reports/RMConsumptionReportPage'));
const ProductionBatchReportPage = lazy(() => import('@/pages/reports/ProductionBatchReportPage'));
const ProductStockReportPage = lazy(() => import('@/pages/reports/ProductStockReportPage'));
const SalesSummaryReportPage = lazy(() => import('@/pages/reports/SalesSummaryReportPage'));
const ProductPerformanceReportPage = lazy(() => import('@/pages/reports/ProductPerformanceReportPage'));
const PurchaseVendorReportPage = lazy(() => import('@/pages/reports/PurchaseVendorReportPage'));
const QCLabReportPage = lazy(() => import('@/pages/reports/QCLabReportPage'));
const WastageLossReportPage = lazy(() => import('@/pages/reports/WastageLossReportPage'));
const StockAgingReportPage = lazy(() => import('@/pages/reports/StockAgingReportPage'));
const OperatorProductivityReportPage = lazy(() => import('@/pages/reports/OperatorProductivityReportPage'));
const ProfitabilityReportPage = lazy(() => import('@/pages/reports/ProfitabilityReportPage'));

// Placeholder for missing modules
const PlaceholderPage = ({ title }) => (
  <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
    <div className="text-center">
      <h2 className="text-xl font-medium text-slate-600 dark:text-slate-400">{title} Page</h2>
      <p className="mt-2 text-sm text-slate-500">Coming soon in the next phase.</p>
    </div>
  </div>
);

// Dashboard Route Wrapper for role-based redirects
const DashboardRouteWrapper = ({ children }) => {
  const { user } = useAuthStore();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (user.role === 'MAIN_MASTER' || user.role === 'SUPERVISOR') {
    return children;
  }
  
  return <Navigate to={getRedirectPathByRole(user.role)} replace />;
};

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error) {
    const isChunkError = 
      error?.message?.includes('dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch') ||
      error?.name === 'ChunkLoadError';
    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RouteErrorBoundary] Caught error:', error, errorInfo);
    const isChunk = 
      error?.message?.includes('dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch') ||
      error?.name === 'ChunkLoadError';

    if (isChunk) {
      const lastReload = sessionStorage.getItem('chunk_reload_time');
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 8000) {
        sessionStorage.setItem('chunk_reload_time', String(now));
        const url = new URL(window.location.href);
        url.searchParams.set('_v', String(now));
        window.location.replace(url.toString());
      }
    }
  }

  handleReload = () => {
    sessionStorage.removeItem('chunk_reload_time');
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString());
    window.location.replace(url.toString());
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, isChunkError: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.state.isChunkError) {
        return (
          <div className="flex h-[80vh] flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-indigo-100 dark:border-indigo-900/50">
              <RotateCw className="w-6 h-6 animate-spin-hover" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Page Update Available</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md">
              A newer version of this module is available. Click below to load the latest version.
            </p>
            <button
              onClick={this.handleReload}
              className="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" /> Reload Page
            </button>
          </div>
        );
      }

      return (
        <div className="flex h-[80vh] flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-rose-100 dark:border-rose-900/50">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Something Went Wrong</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred while loading this view.'}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" /> Try Again
            </button>
            <button
              onClick={() => {
                this.handleReset();
                window.location.href = '/dashboard';
              }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppRouter = () => {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={
      <div className="flex h-[80vh] items-center justify-center bg-[#F4F3FF] dark:bg-slate-950 rounded-2xl">
        <div className="text-center space-y-4">
          <RotateCw className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Synchronizing ERP modules...</p>
        </div>
      </div>
    }>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/quote/:quotationId/:token" element={<SupplierQuotationPublicPage />} />
        <Route path="/asset-quote/:pqId/:token" element={<AssetQuotationPublicPage />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Shared Routes */}
            <Route path="/profile" element={<ChangeProfilePage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/attendance" element={<CheckInOutPage />} />
            <Route path="/qr-lifecycle/:id" element={<QRLifecyclePage />} />

            {/* Dashboard Routes */}
            <Route path="/dashboard" element={
              <DashboardRouteWrapper>
                <DashboardPage />
              </DashboardRouteWrapper>
            } />
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR']} />}>
              <Route path="/dashboard/executive"   element={<ExecutiveDashboardPage />} />
              <Route path="/dashboard/hr"          element={<HRDashboardPage />} />
              <Route path="/dashboard/maintenance" element={<MaintenanceDashboardPage />} />
            </Route>
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'SALES_TEAM']} />}>
              <Route path="/dashboard/sales"     element={<SalesDashboardPage />} />
              <Route path="/dashboard/finance"   element={<FinanceDashboardPage />} />
            </Route>
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'PRODUCTION_STAFF']} />}>
              <Route path="/dashboard/production" element={<ProductionDashboardPage />} />
            </Route>
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT']} />}>
              <Route path="/dashboard/inventory" element={<InventoryDashboardPage />} />
            </Route>
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT']} />}>
              <Route path="/dashboard/lab" element={<LabDashboardPage />} />
            </Route>
            
            {/* Parties Module */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT']} />}>
              <Route path="/parties/customers" element={<CustomerListPage />} />
              <Route path="/parties/customers/add" element={<CustomerListPage />} />
              <Route path="/parties/customers/edit/:id" element={<CustomerListPage />} />
              <Route path="/parties/suppliers" element={<SupplierListPage />} />
              <Route path="/parties/suppliers/add" element={<SupplierListPage />} />
              <Route path="/parties/suppliers/edit/:id" element={<SupplierListPage />} />
            </Route>

            {/* Item Setup Module */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT']} />}>
              <Route path="/setup/rm-category" element={<RMCategoryListPage />} />
            </Route>
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR']} />}>
              <Route path="/setup/raw-material" element={<RawMaterialListPage />} />
              <Route path="/setup/non-inventory" element={<NonInventoryItemListPage />} />
              <Route path="/setup/product-category" element={<ProductCategoryListPage />} />
              <Route path="/setup/product" element={<ProductListPage />} />
              <Route path="/setup/tax" element={<TaxSettingsPage />} />
            </Route>
            
            {/* Purchase Orders (View) */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER']} />}>
              <Route path="/purchase-orders" element={<POListPage />} />
              <Route path="/purchase-orders/:id" element={<PODetailPage />} />
              <Route path="/purchase-quotations" element={<RMQuotationPage />} />
            </Route>
            
            {/* Create PO — must come BEFORE /purchase-orders/:id to avoid conflict */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'PURCHASE_ACCOUNTANT']} />}>
              <Route path="/purchase-orders/create" element={<CreatePOPage />} />
              <Route path="/purchase-orders/edit/:id" element={<EditPOPage />} />
            </Route>

            {/* Purchase Return */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF']} />}>
              <Route path="/purchase-return/add" element={<PurchaseReturnListPage />} />
              <Route path="/purchase-return/list" element={<PurchaseReturnListPage />} />
            </Route>
            
            {/* GRN Module */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']} />}>
              <Route path="/grn/upcoming" element={<UpcomingDeliveriesPage />} />
              <Route path="/grn/view/:grnId" element={<GRNViewPage />} />
              <Route path="/grn/list" element={<GRNListPage />} />
            </Route>

            {/* GRN Receive */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'MATERIALS_RECEIVER']} />}>
              <Route path="/grn/receive/:poId" element={<ReceiveDeliveryPage />} />
            </Route>

            {/* Inventory Management */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER']} />}>
              <Route path="/inventory/upload" element={<InventoryUploadPage />} />
              <Route path="/inventory/list" element={<Navigate to="/rm/stock" replace />} />
              <Route path="/inventory/batches" element={<Navigate to="/rm/stock" replace />} />
            </Route>

            {/* RM Stock */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER']} />}>
              <Route path="/rm/stock" element={<RMStockPage />} />
              <Route path="/rm/stock/low" element={<RMLowStockPage />} />
              <Route path="/rm/stock-adjustment/add" element={<StockAdjustmentListPage />} />
              <Route path="/rm/stock-adjustment/list" element={<StockAdjustmentListPage />} />
            </Route>

            {/* Lab Testing */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']} />}>
              <Route path="/lab/pending" element={<PendingLabTestsPage />} />
              <Route path="/lab/results" element={<LabResultsPage />} />
            </Route>
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'LAB_ASSISTANT', 'SUPERVISOR']} />}>
              <Route path="/lab/test/:grnId" element={<LabTestPage />} />
            </Route>

            {/* NEW: RM Lab Category & Required Results */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'LAB_ASSISTANT']} />}>
              <Route path="/lab/rm-lab-category" element={<RMLabCategoryPage />} />
            </Route>

            {/* Lab Inventory */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT']} />}>
              <Route path="/lab-inventory/list" element={<LabInventoryListPage />} />
              <Route path="/lab-inventory/add" element={<LabInventoryListPage />} />
              <Route path="/lab-inventory/use" element={<LabInventoryUsagePage />} />
            </Route>

            {/* Sales Module */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'SALES_TEAM']} />}> 
              <Route path="/sales/pos" element={<AddOrderPage />} />
              <Route path="/sales/add" element={<AddOrderPage />} />
              <Route path="/sales/list" element={<SalesListPage />} />
              <Route path="/sales/return" element={<SalesReturnsPage />} />
              <Route path="/sales/dashboard" element={<SalesDashboard />} />
            </Route>
            {/* Products */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM']} />}>
              <Route path="/products/stock" element={<ProductStockPage />} />
              <Route path="/products/low-stock" element={<LowStockAlertsPage />} />
            </Route>

            {/* Production */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM']} />}>
              <Route path="/production/batches" element={<ProductionsPage />} />
              <Route path="/production/add" element={<AddProductionPage />} />
              <Route path="/production/loss" element={<ProductionLossPage />} />
              <Route path="/production/loss-report" element={<LossReportPage />} />
              <Route path="/production/qc-queue" element={<QCQueuePage />} />
            </Route>

            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR']} />}>
              <Route path="/production/wastage" element={<ProductWastagePage />} />
            </Route>

            {/* Customer Orders */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM']} />}>
              <Route path="/orders/add" element={<OrderListPage />} />
              <Route path="/orders/list" element={<OrderListPage />} />
              <Route path="/orders/edit/:id" element={<OrderListPage />} />
              <Route path="/orders/status" element={<OrderStatusPage />} />
            </Route>

            {/* Operations Calendar */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM']} />}>
              <Route path="/calendar" element={<OperationsCalendarPage />} />
            </Route>

            {/* Forecasting */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM']} />}>
              <Route path="/forecasting" element={<Navigate to="/forecasting/stock" replace />} />
              <Route path="/forecasting/calendar" element={<Navigate to="/calendar" replace />} />
              <Route path="/forecasting/stock" element={<StockForecastingPage />} />
              <Route path="/forecasting/inventory" element={<StockForecastingPage />} />
              <Route path="/forecasting/workforce" element={<WorkforceForecastingPage />} />
              <Route path="/forecasting/cashflow" element={<CashFlowForecastingPage />} />
              <Route path="/forecasting/vendor" element={<VendorForecastingPage />} />
              <Route path="/forecasting/production" element={<ProductionYieldForecastingPage />} />
              <Route path="/forecasting/what-if" element={<WhatIfForecastingPage />} />
              <Route path="/forecasting/whatif" element={<WhatIfForecastingPage />} />
              <Route path="/forecasting/returns" element={<ReturnsForecastingPage />} />
              <Route path="/forecasting/:section" element={<PredictiveForecastingHubPage />} />
              <Route path="/forecasting/by-order" element={<Navigate to="/forecasting/stock" replace />} />
              <Route path="/forecasting/by-product" element={<Navigate to="/forecasting/stock" replace />} />
              <Route path="/forecasting/ai-studio" element={<Navigate to="/forecasting/stock" replace />} />
            </Route>

            {/* Finance & Accounts */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'PURCHASE_ACCOUNTANT']} />}>
              <Route path="/finance/expenses" element={<ExpensesPage />} />
              <Route path="/finance/accounts" element={<PlaceholderPage title="Accounts" />} />
            </Route>

            {/* Admin & Setup */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR']} />}>
              <Route path="/setup/items" element={<PlaceholderPage title="Item Setup" />} />
              <Route path="/audit-logs" element={<AuditLogListPage />} />
              <Route path="/admin/notifications-audit" element={<NotificationAuditPanel />} />
              <Route path="/admin/backups" element={<BackupListPage />} />
            </Route>

            {/* Raw Material Waste */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER']} />}>
              <Route path="/waste/raw-material" element={<RMWasteListPage />} />
              <Route path="/waste/raw-material/add" element={<RMWasteListPage />} />
              <Route path="/waste/raw-material/edit/:id" element={<RMWasteListPage />} />
            </Route>
            
            {/* Notifications (All Roles) */}
            <Route path="/notifications" element={<NotificationsListPage />} />
            
            {/* Asset Management Module */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR']} />}>
              <Route path="/asset-management/requests" element={<AssetManagementPage defaultTab="requests" />} />
              <Route path="/asset-management/quotations" element={<AssetManagementPage defaultTab="quotations" />} />
              <Route path="/asset-management/orders" element={<AssetManagementPage defaultTab="orders" />} />
              <Route path="/asset-management/grpo" element={<AssetManagementPage defaultTab="grpo" />} />
              <Route path="/asset-management/invoice" element={<AssetManagementPage defaultTab="invoice" />} />
              <Route path="/asset-management/register" element={<AssetManagementPage defaultTab="register" />} />
              <Route path="/asset-management/reports" element={<AssetManagementPage defaultTab="reports" />} />
            </Route>

            {/* Reports & Analytics (Standard: Admin, Supervisor, Purchase Accountant) */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT']} />}>
              <Route path="/reports/rm-consumption" element={<RMConsumptionReportPage />} />
              <Route path="/reports/production-batches" element={<ProductionBatchReportPage />} />
              <Route path="/reports/product-stock" element={<ProductStockReportPage />} />
              <Route path="/reports/sales-summary" element={<SalesSummaryReportPage />} />
              <Route path="/reports/product-performance" element={<ProductPerformanceReportPage />} />
              <Route path="/reports/purchase-vendor" element={<PurchaseVendorReportPage />} />
              <Route path="/reports/qc-lab" element={<QCLabReportPage />} />
              <Route path="/reports/wastage-loss" element={<WastageLossReportPage />} />
              <Route path="/reports/stock-aging" element={<StockAgingReportPage />} />
            </Route>

            {/* Reports & Analytics (Operator Productivity: Admin & Supervisor) */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR']} />}>
              <Route path="/reports/operator-productivity" element={<OperatorProductivityReportPage />} />
            </Route>

            {/* Reports & Analytics (Profitability: Admin & Purchase Accountant) */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'PURCHASE_ACCOUNTANT']} />}>
              <Route path="/reports/profitability" element={<ProfitabilityReportPage />} />
            </Route>

            {/* Admin only */}
            <Route element={<RoleGuard allowedRoles={['MAIN_MASTER']} />}>
              <Route path="/admin/users" element={<UserManagementPage />} />
              <Route path="/admin/roles" element={<UserRolePage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </RouteErrorBoundary>
  );
};

export default AppRouter;
