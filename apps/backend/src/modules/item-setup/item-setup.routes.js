const express = require('express');
const ItemSetupController = require('./item-setup.controller');
const mouldMasterController = require('./mouldMaster.controller');
const bulkStorageUnitController = require('./bulkStorageUnit.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

const router = express.Router();

router.use(authMiddleware);
// Based on typical ERP patterns, Item Setup is usually restricted to Admin/Master
const allowedRoles = ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'ACCOUNTANT', 'MANAGER'];

// Mould Master Specialized Endpoints
router.get('/mould-master/next-code', mouldMasterController.getNextCode);
router.patch('/mould-master/:id/status', roleMiddleware(allowedRoles), mouldMasterController.toggleStatus);

// Bulk Storage Unit Specialized Endpoints
router.get('/bulk-storage-unit/next-code', bulkStorageUnitController.getNextCode);
router.patch('/bulk-storage-unit/:id/status', roleMiddleware(allowedRoles), bulkStorageUnitController.toggleStatus);

const setupRoutes = (entity, controller) => {
  router.post(`/${entity}`, roleMiddleware(allowedRoles), controller.create);
  router.get(`/${entity}`, controller.getAll); // Allow authenticated users to fetch categories for dropdowns
  router.get(`/${entity}/:id`, controller.getById);
  router.put(`/${entity}/:id`, roleMiddleware(allowedRoles), controller.update);
  router.delete(`/${entity}/:id`, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), controller.delete);
};

setupRoutes('rm-category', ItemSetupController.RMCategory);
setupRoutes('raw-material', ItemSetupController.RawMaterial);
setupRoutes('non-inventory-item', ItemSetupController.NonInventoryItem);
setupRoutes('product-category', ItemSetupController.ProductCategory);
setupRoutes('product', ItemSetupController.Product);
setupRoutes('expense-category', ItemSetupController.ExpenseCategory);
setupRoutes('mould-master', mouldMasterController);
setupRoutes('bulk-storage-unit', bulkStorageUnitController);

module.exports = router;
