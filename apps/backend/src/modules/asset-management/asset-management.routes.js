const express = require('express');
const router = express.Router();
const assetController = require('./asset-management.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Public supplier endpoints (bypass authentication)
router.get('/public/quotations/:pqId/:token', assetController.getPublicQuotation);
router.post('/public/quotations/:pqId/:token/submit', assetController.submitPublicQuotation);
router.post('/public/quotations/:pqId/:token/request-resubmission', assetController.requestResubmission);

router.use(authMiddleware);

// Budgets
router.get('/budgets', assetController.getAllBudgets);
router.put('/budgets', assetController.updateBudget);

// Purchase Requests (PR)
router.get('/requests', assetController.getAllPRs);
router.get('/requests/:id', assetController.getPRById);
router.post('/requests', assetController.createPR);
router.put('/requests/:id', assetController.updatePR);
router.delete('/requests/:id', assetController.deletePR);
router.patch('/requests/:id/approve', assetController.approvePR);

// Purchase Quotations (PQ)
router.get('/quotations', assetController.getAllPQs);
router.get('/quotations/:id', assetController.getPQById);
router.post('/quotations', assetController.createPQ);
router.put('/quotations/:id', assetController.updatePQ);
router.delete('/quotations/:id', assetController.deletePQ);
router.get('/quotations/compare/:prNo', assetController.getPQComparison);
router.post('/quotations/send-requests', assetController.sendQuotationRequests);
router.post('/quotations/:id/resend-supplier-link', assetController.resendSupplierLink);

// Purchase Orders (PO) — both /orders and /purchase-orders (frontend alias)
router.get('/orders', assetController.getAllPOs);
router.get('/orders/:id', assetController.getPOById);
router.post('/orders', assetController.createPO);
router.put('/orders/:id', assetController.updatePO);
router.delete('/orders/:id', assetController.deletePO);
router.get('/purchase-orders', assetController.getAllPOs);
router.get('/purchase-orders/:id', assetController.getPOById);
router.post('/purchase-orders', assetController.createPO);
router.put('/purchase-orders/:id', assetController.updatePO);
router.delete('/purchase-orders/:id', assetController.deletePO);

// Goods Receipt PO (GRPO)
router.get('/grpo', assetController.getAllGRPOs);
router.post('/grpo', assetController.createGRPO);
router.put('/grpo/:id', assetController.updateGRPO);
router.delete('/grpo/:id', assetController.deleteGRPO);

// A/P Invoices — both /invoices and /ap-invoices (frontend alias)
router.get('/invoices', assetController.getAllInvoices);
router.post('/invoices', assetController.createInvoice);
router.put('/invoices/:id', assetController.updateInvoice);
router.delete('/invoices/:id', assetController.deleteInvoice);
router.get('/ap-invoices', assetController.getAllInvoices);
router.post('/ap-invoices', assetController.createInvoice);
router.put('/ap-invoices/:id', assetController.updateInvoice);
router.delete('/ap-invoices/:id', assetController.deleteInvoice);
router.patch('/ap-invoices/:id/mark-paid', assetController.markInvoicePaid);
router.patch('/invoices/:id/mark-paid', assetController.markInvoicePaid);

// Asset Register — both /register and /assets (frontend alias)
router.get('/register', assetController.getAllAssets);
router.get('/register/:id', assetController.getAssetById);
router.get('/register/:id/depreciation', assetController.getAssetDepreciation);
router.post('/register', assetController.createAsset);
router.get('/assets', assetController.getAllAssets);
router.post('/assets', assetController.createAsset);
router.patch('/assets/:id/decommission', assetController.decommissionAsset);
router.get('/assets/:id', assetController.getAssetById);
router.get('/assets/:id/depreciation', assetController.getAssetDepreciation);
router.patch('/register/:id/decommission', assetController.decommissionAsset);

// Autocomplete & Master Lookup
router.get('/master/assets', assetController.searchAssetMaster);
router.get('/master/ai-hsn', assetController.getAiHsnCode);
router.post('/master/assets', assetController.createAssetMaster);

// GSTIN Live Verification (proxy to GST portal)
router.get('/verify-gstin/:gstin', assetController.verifyGSTIN);

// Reports
router.get('/reports', assetController.getReports);

// Communication & Logging
router.get('/communication-logs/:documentType/:documentNo', assetController.getCommunicationLogs);
router.post('/resend-communication', assetController.resendCommunication);

module.exports = router;
