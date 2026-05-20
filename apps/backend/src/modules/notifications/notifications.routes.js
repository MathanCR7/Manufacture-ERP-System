const express = require('express');
const router = express.Router();
const notificationsController = require('./notifications.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/stream', notificationsController.connectSSE);
router.get('/', notificationsController.getNotifications);
router.patch('/seen-all', notificationsController.markAllAsSeen);
router.patch('/:id/seen', notificationsController.markAsSeen);
router.get('/audit', notificationsController.getAuditLogs);

module.exports = router;
