const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/user/user.routes');
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');
const rmRoutes = require('./rm');
const partiesRoutes = require('../modules/parties/parties.routes');
const itemSetupRoutes = require('../modules/item-setup/item-setup.routes');
const auditRoutes = require('../modules/audit/audit.routes');

// System
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', authMiddleware, dashboardRoutes);
router.use('/parties', authMiddleware, partiesRoutes);
router.use('/item-setup', authMiddleware, itemSetupRoutes);
router.use('/audit-logs', authMiddleware, auditRoutes);
router.use('/', rmRoutes);

router.use('/po', require('../modules/purchase/po.routes'));
// router.use('/grn', require('../modules/grn/grn.routes'));

router.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));

module.exports = router;
