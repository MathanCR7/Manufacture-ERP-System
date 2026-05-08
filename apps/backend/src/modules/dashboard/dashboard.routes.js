const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboard.controller');
const authenticateToken = require('../../middlewares/auth.middleware');

router.get('/summary', authenticateToken, dashboardController.getDashboardSummary);

module.exports = router;
