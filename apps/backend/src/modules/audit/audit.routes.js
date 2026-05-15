const express = require('express');
const router = express.Router();
const auditController = require('./audit.controller');
const roleMiddleware = require('../../middlewares/role.middleware');

// Only MAIN_MASTER and SUPERVISOR can view audit logs
router.get('/', roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), auditController.getAll);

module.exports = router;
