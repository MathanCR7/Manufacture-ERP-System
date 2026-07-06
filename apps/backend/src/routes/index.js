const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/user/user.routes');
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');
const rmRoutes = require('../modules/rawmaterial/rawmaterial.routes');
const partiesRoutes = require('../modules/parties/parties.routes');
const itemSetupRoutes = require('../modules/item-setup/item-setup.routes');
const auditRoutes = require('../modules/audit/audit.routes');
const notificationsRoutes = require('../modules/notifications/notifications.routes');

// System
router.use('/', require('./dashboard_api.routes'));
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', authMiddleware, dashboardRoutes);
router.use('/parties', authMiddleware, partiesRoutes);
router.use('/item-setup', authMiddleware, itemSetupRoutes);
router.use('/setup/tax', require('../modules/setup/tax.routes'));
router.use('/audit-logs', authMiddleware, auditRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/backups', require('../modules/backup/backup.routes'));
router.use('/', rmRoutes);

router.use('/po', require('../modules/purchase/po.routes'));
router.use('/grn', require('../modules/grn/grn.routes'));

// ERP modules
router.use('/purchase-return', authMiddleware, require('../modules/purchase-return/purchase-return.routes'));
router.use('/inventory', authMiddleware, require('../modules/inventory/inventory.routes'));
router.use('/lab-inventory', authMiddleware, require('../modules/lab-inventory/lab-inventory.routes'));
router.use('/rm-lab-category', authMiddleware, require('../modules/rm-lab-category/rm-lab-category.routes'));
router.use('/rm-stock-adjustment', authMiddleware, require('../modules/rm-stock-adjustment/rm-stock-adjustment.routes'));

// New modules
router.use('/attendance', require('../modules/attendance/attendance.routes'));
router.use('/search', require('../modules/search/search.routes'));
router.use('/qr-lifecycle', require('../modules/qr-lifecycle/qr-lifecycle.routes'));

// Production & Orders Modules
router.use('/products', authMiddleware, require('../modules/production/products.routes'));
router.use('/production', authMiddleware, require('../modules/production/production.routes'));
router.use('/orders', authMiddleware, require('../modules/production/orders.routes'));
router.use('/forecasting', authMiddleware, require('../modules/production/forecasting.routes'));

// Sales Module
router.use('/sales', authMiddleware, require('../modules/sales/sales.routes'));

// Asset Management Module
router.use('/asset-management', authMiddleware, require('../modules/asset-management/asset-management.routes'));

// Finance Module
router.use('/finance', authMiddleware, require('../modules/finance/finance.routes'));

router.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));

module.exports = router;
