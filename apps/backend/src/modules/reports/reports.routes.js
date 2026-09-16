const express = require('express');
const router = express.Router();
const reportsController = require('./reports.controller');
const roleMiddleware = require('../../middlewares/role.middleware');

const STANDARD_REPORT_ROLES = ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'];
const OPERATOR_REPORT_ROLES = ['MAIN_MASTER', 'SUPERVISOR'];
const PROFITABILITY_REPORT_ROLES = ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'];

// 1. Raw Material Consumption
router.get('/rm-consumption', roleMiddleware(STANDARD_REPORT_ROLES), (req, res, next) => {
  reportsController.getRMConsumptionReport(req, res, next);
});

// 2. Production Batches
router.get('/production-batches', roleMiddleware(STANDARD_REPORT_ROLES), (req, res, next) => {
  reportsController.getProductionBatchesReport(req, res, next);
});

// 3. Product Stock
router.get('/product-stock', roleMiddleware(STANDARD_REPORT_ROLES), (req, res, next) => {
  reportsController.getProductStockReport(req, res, next);
});

// 4. Sales Summary
router.get('/sales-summary', roleMiddleware(STANDARD_REPORT_ROLES), (req, res, next) => {
  reportsController.getSalesSummaryReport(req, res, next);
});

// 5. Product Performance (Top & Least Selling)
router.get('/product-performance', roleMiddleware(STANDARD_REPORT_ROLES), (req, res, next) => {
  reportsController.getProductPerformanceReport(req, res, next);
});

// 6. Purchase & Vendor
router.get('/purchase-vendor', roleMiddleware(STANDARD_REPORT_ROLES), (req, res, next) => {
  reportsController.getPurchaseVendorReport(req, res, next);
});

// 7. QC / Lab Tests
router.get('/qc-lab', roleMiddleware(STANDARD_REPORT_ROLES), (req, res, next) => {
  reportsController.getQCLabReport(req, res, next);
});

// 8. Wastage & Loss
router.get('/wastage-loss', roleMiddleware(STANDARD_REPORT_ROLES), (req, res, next) => {
  reportsController.getWastageLossReport(req, res, next);
});

// 9. Stock Aging
router.get('/stock-aging', roleMiddleware(STANDARD_REPORT_ROLES), (req, res, next) => {
  reportsController.getStockAgingReport(req, res, next);
});

// 10. Operator Productivity (Admin & Supervisor only)
router.get('/operator-productivity', roleMiddleware(OPERATOR_REPORT_ROLES), (req, res, next) => {
  reportsController.getOperatorProductivityReport(req, res, next);
});

// 11. Profitability (Admin & Accountant only)
router.get('/profitability', roleMiddleware(PROFITABILITY_REPORT_ROLES), (req, res, next) => {
  reportsController.getProfitabilityReport(req, res, next);
});

module.exports = router;
