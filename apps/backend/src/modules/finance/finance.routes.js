const express = require('express');
const multer = require('multer');
const controller = require('./finance.controller');
const paymentController = require('./payment.controller');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max per file
});

// --- Existing Expense Endpoints (Preserved 100%) ---
router.get('/expenses', controller.getExpenses);
router.get('/expenses/next-number', controller.getNextExpenseNumber);
router.post('/expenses', controller.createExpense);
router.post('/expenses/bulk', controller.createBulkExpenses);
router.post('/expenses/bulk-delete', controller.deleteBulkExpenses);
router.get('/expenses/summary', controller.getExpensesSummary);

// Attachments upload and removal
router.post('/expenses/upload-attachments', upload.array('files', 10), controller.uploadExpenseAttachments);
router.delete('/expenses/attachments', controller.removeExpenseAttachmentFile);

router.put('/expenses/:id', controller.updateExpense);
router.delete('/expenses/:id', controller.deleteExpense);

// --- New Enterprise Finance Endpoints ---
router.get('/dashboard', controller.getFinanceDashboard);
router.get('/documents', controller.getFinanceDocuments);
router.get('/documents/:type/:id', controller.getFinanceDocumentDetail);
router.get('/parties', controller.getPartiesList);
router.get('/parties/:id/ledger', controller.getPartyLedger);
router.get('/aging', controller.getAgingReport);
router.get('/gst', controller.getGstRegister);
router.get('/cashbook', controller.getCashBankBook);
router.get('/quotations', controller.getQuotationPipeline);

// --- Payment & Allocations Endpoints ---
router.get('/bank-accounts', paymentController.getBankAccounts);
router.get('/payments', paymentController.getPaymentsList);
router.post('/payments', paymentController.createPayment);
router.post('/payments/:id/reverse', paymentController.reversePayment);
router.post('/payments/:id/reallocate', paymentController.reallocatePayment);

module.exports = router;
