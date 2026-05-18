import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/guards/ProtectedRoute';
import RoleGuard from '@/components/guards/RoleGuard';
import AppShell from '@/components/layout/AppShell';

import LoginPage from '@/modules/auth/pages/LoginPage';
import UserRolePage from '@/modules/admin/pages/UserRolePage';
import UserManagementPage from '@/modules/admin/pages/UserManagementPage';

import POListPage from '@/modules/purchase/pages/POListPage';
import CreatePOPage from '@/modules/purchase/pages/CreatePOPage';
import EditPOPage from '@/modules/purchase/pages/EditPOPage';
import PODetailPage from '@/modules/purchase/pages/PODetailPage';
import RMStockPage from '@/modules/purchase/pages/RMStockPage';
import RMLowStockPage from '@/modules/purchase/pages/RMLowStockPage';
import PurchaseReturnAddPage from '@/modules/purchase/pages/PurchaseReturnAddPage';
import PurchaseReturnListPage from '@/modules/purchase/pages/PurchaseReturnListPage';

import DashboardPage from '@/modules/dashboard/pages/DashboardPage';

// Parties Module
import CustomerListPage from '@/modules/parties/pages/CustomerListPage';
import AddCustomerPage from '@/modules/parties/pages/AddCustomerPage';
import SupplierListPage from '@/modules/parties/pages/SupplierListPage';
import AddSupplierPage from '@/modules/parties/pages/AddSupplierPage';

// Item Setup Module
import AddRMCategoryPage from '@/modules/item-setup/pages/AddRMCategoryPage';
import RMCategoryListPage from '@/modules/item-setup/pages/RMCategoryListPage';
import AddRawMaterialPage from '@/modules/item-setup/pages/AddRawMaterialPage';
import RawMaterialListPage from '@/modules/item-setup/pages/RawMaterialListPage';
import AddNonInventoryItemPage from '@/modules/item-setup/pages/AddNonInventoryItemPage';
import NonInventoryItemListPage from '@/modules/item-setup/pages/NonInventoryItemListPage';
import AddProductCategoryPage from '@/modules/item-setup/pages/AddProductCategoryPage';
import ProductCategoryListPage from '@/modules/item-setup/pages/ProductCategoryListPage';
import AddProductPage from '@/modules/item-setup/pages/AddProductPage';
import ProductListPage from '@/modules/item-setup/pages/ProductListPage';

import AuditLogListPage from '@/modules/admin/pages/AuditLogListPage';
import NotificationAuditPanel from '@/modules/admin/pages/NotificationAuditPanel';

import RMWasteListPage from '@/modules/waste/pages/RMWasteListPage';
import CreateRMWastePage from '@/modules/waste/pages/CreateRMWastePage';

// GRN Module
import UpcomingDeliveriesPage from '@/modules/grn/pages/UpcomingDeliveriesPage';
import ReceiveDeliveryPage from '@/modules/grn/pages/ReceiveDeliveryPage';
import GRNViewPage from '@/modules/grn/pages/GRNViewPage';
import GRNListPage from '@/modules/grn/pages/GRNListPage';

// Lab Module
import PendingLabTestsPage from '@/modules/lab/pages/PendingLabTestsPage';
import LabTestPage from '@/modules/lab/pages/LabTestPage';
import LabResultsPage from '@/modules/lab/pages/LabResultsPage';
import LabInventoryListPage from '@/modules/lab/pages/LabInventoryListPage';
import LabInventoryAddPage from '@/modules/lab/pages/LabInventoryAddPage';
import LabInventoryUsagePage from '@/modules/lab/pages/LabInventoryUsagePage';

// NEW: RM Lab Category & Required Results
import RMLabCategoryPage from '@/modules/lab/pages/RMLabCategoryPage';
import RMRequiredLabResultsPage from '@/modules/lab/pages/RMRequiredLabResultsPage';

// Shared
import ChangeProfilePage from '@/modules/shared/pages/ChangeProfilePage';
import ChangePasswordPage from '@/modules/shared/pages/ChangePasswordPage';
import CheckInOutPage from '@/modules/shared/pages/CheckInOutPage';
import QRLifecyclePage from '@/modules/shared/pages/QRLifecyclePage';

// Inventory Module
import InventoryUploadPage from '@/modules/inventory/pages/InventoryUploadPage';

// Placeholder for missing modules
const PlaceholderPage = ({ title }) => (
  <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
    <div className="text-center">
      <h2 className="text-xl font-medium text-slate-600 dark:text-slate-400">{title} Page</h2>
      <p className="mt-2 text-sm text-slate-500">Coming soon in the next phase.</p>
    </div>
  </div>
);

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          
          {/* Shared Routes */}
          <Route path="/profile" element={<ChangeProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/attendance" element={<CheckInOutPage />} />
          <Route path="/qr-lifecycle/:id" element={<QRLifecyclePage />} />
          
          {/* Parties Module */}
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT']} />}>
            <Route path="/parties/customers" element={<CustomerListPage />} />
            <Route path="/parties/customers/add" element={<AddCustomerPage />} />
            <Route path="/parties/customers/edit/:id" element={<AddCustomerPage />} />
            <Route path="/parties/suppliers" element={<SupplierListPage />} />
            <Route path="/parties/suppliers/add" element={<AddSupplierPage />} />
            <Route path="/parties/suppliers/edit/:id" element={<AddSupplierPage />} />
          </Route>

          {/* Item Setup Module */}
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT']} />}>
            <Route path="/setup/rm-category/add" element={<AddRMCategoryPage />} />
            <Route path="/setup/rm-category/edit/:id" element={<AddRMCategoryPage />} />
            <Route path="/setup/rm-category" element={<RMCategoryListPage />} />
          </Route>
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR']} />}>
            <Route path="/setup/raw-material/add" element={<AddRawMaterialPage />} />
            <Route path="/setup/raw-material/edit/:id" element={<AddRawMaterialPage />} />
            <Route path="/setup/raw-material" element={<RawMaterialListPage />} />
            <Route path="/setup/non-inventory/add" element={<AddNonInventoryItemPage />} />
            <Route path="/setup/non-inventory/edit/:id" element={<AddNonInventoryItemPage />} />
            <Route path="/setup/non-inventory" element={<NonInventoryItemListPage />} />
            <Route path="/setup/product-category/add" element={<AddProductCategoryPage />} />
            <Route path="/setup/product-category/edit/:id" element={<AddProductCategoryPage />} />
            <Route path="/setup/product-category" element={<ProductCategoryListPage />} />
            <Route path="/setup/product/add" element={<AddProductPage />} />
            <Route path="/setup/product/edit/:id" element={<AddProductPage />} />
            <Route path="/setup/product" element={<ProductListPage />} />
          </Route>
          
          {/* Purchase Orders (View) */}
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER']} />}>
            <Route path="/purchase-orders" element={<POListPage />} />
            <Route path="/purchase-orders/:id" element={<PODetailPage />} />
          </Route>
          
          {/* Create PO — must come BEFORE /purchase-orders/:id to avoid conflict */}
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'PURCHASE_ACCOUNTANT']} />}>
            <Route path="/purchase-orders/create" element={<CreatePOPage />} />
            <Route path="/purchase-orders/edit/:id" element={<EditPOPage />} />
          </Route>

          {/* Purchase Return */}
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF']} />}>
            <Route path="/purchase-return/add" element={<PurchaseReturnAddPage />} />
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
            <Route path="/inventory/list" element={<InventoryUploadPage />} />
          </Route>

          {/* RM Stock */}
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER']} />}>
            <Route path="/rm/stock" element={<RMStockPage />} />
            <Route path="/rm/stock/low" element={<RMLowStockPage />} />
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
            <Route path="/lab/rm-required-results" element={<RMRequiredLabResultsPage />} />
          </Route>

          {/* Lab Inventory */}
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT']} />}>
            <Route path="/lab-inventory/list" element={<LabInventoryListPage />} />
            <Route path="/lab-inventory/add" element={<LabInventoryAddPage />} />
            <Route path="/lab-inventory/use" element={<LabInventoryUsagePage />} />
          </Route>

          {/* Sales Module */}
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT']} />}> 
            <Route path="/sales/add" element={<PlaceholderPage title="Add Sale" />} />
            <Route path="/sales/list" element={<PlaceholderPage title="Sale List" />} />
            <Route path="/sales/return/add" element={<PlaceholderPage title="Add Sale Return" />} />
            <Route path="/sales/return/list" element={<PlaceholderPage title="Sale Return List" />} />
          </Route>
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'LAB_ASSISTANT']} />}>
            <Route path="/production/qc-queue" element={<PlaceholderPage title="Production QC Queue" />} />
          </Route>
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR']} />}>
            <Route path="/production/batches" element={<PlaceholderPage title="Production Batches" />} />
          </Route>
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER']} />}>
            <Route path="/production/wastage" element={<PlaceholderPage title="Product Wastage" />} />
          </Route>

          {/* Product Stock */}
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'LAB_ASSISTANT', 'SUPERVISOR']} />}>
            <Route path="/product/stock" element={<PlaceholderPage title="Product Stock" />} />
          </Route>

          {/* Finance & Accounts */}
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'PURCHASE_ACCOUNTANT']} />}>
            <Route path="/finance/expenses" element={<PlaceholderPage title="Expenses" />} />
            <Route path="/finance/accounts" element={<PlaceholderPage title="Accounts" />} />
          </Route>

          {/* Admin & Setup */}
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER', 'SUPERVISOR']} />}>
            <Route path="/setup/items" element={<PlaceholderPage title="Item Setup" />} />
            <Route path="/waste/raw-material" element={<RMWasteListPage />} />
            <Route path="/waste/raw-material/add" element={<CreateRMWastePage />} />
            <Route path="/audit-logs" element={<AuditLogListPage />} />
            <Route path="/admin/notifications-audit" element={<NotificationAuditPanel />} />
          </Route>
          
          {/* Notifications (All Roles) */}
          <Route path="/notifications" element={<PlaceholderPage title="Notifications" />} />
          
          {/* Admin only */}
          <Route element={<RoleGuard allowedRoles={['MAIN_MASTER']} />}>
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/roles" element={<UserRolePage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRouter;
