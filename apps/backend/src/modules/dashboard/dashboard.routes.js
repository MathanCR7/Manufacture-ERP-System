const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboard.controller');
const authenticateToken = require('../../middlewares/auth.middleware');

// Original dashboard summary
router.get('/summary', authenticateToken, dashboardController.getDashboardSummary);

// Multi-Dashboard Endpoints
router.get('/executive',   authenticateToken, dashboardController.getExecutiveDashboard);
router.get('/sales',       authenticateToken, dashboardController.getSalesDashboard);
router.get('/production',  authenticateToken, dashboardController.getProductionDashboard);
router.get('/inventory',   authenticateToken, dashboardController.getInventoryDashboard);
router.get('/finance',     authenticateToken, dashboardController.getFinanceDashboard);
router.get('/hr',          authenticateToken, dashboardController.getHRDashboard);
router.get('/maintenance', authenticateToken, dashboardController.getMaintenanceDashboard);

module.exports = router;
