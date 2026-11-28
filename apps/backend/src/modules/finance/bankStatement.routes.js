const express = require('express');
const multer = require('multer');
const ctrl = require('./bankStatement.controller');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    const ext = String(file.originalname || '').toLowerCase().split('.').pop();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      return cb(new Error('Only .xlsx, .xls, and .csv files up to 10 MB are allowed.'));
    }
    return cb(null, true);
  }
});

const handleUploadSingle = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    return next();
  });
};

// Permissions & Bank Master Accounts
router.get('/permissions', ctrl.requirePermission('view'), ctrl.getPermissions);
router.get('/accounts', ctrl.requirePermission('view'), ctrl.getAccounts);
router.post('/accounts', ctrl.requirePermission('upload'), ctrl.createAccount);
router.put('/accounts/:id', ctrl.requirePermission('edit'), ctrl.updateAccount);
router.post('/accounts/reorder', ctrl.requirePermission('edit'), ctrl.reorderAccounts);
router.post('/accounts/:id/move-transactions', ctrl.requirePermission('edit'), ctrl.moveAccountTransactions);
router.delete('/accounts/:id', ctrl.requirePermission('delete'), ctrl.deleteAccount);

// Step 1-3: Preview, Recheck & Atomic Commit
router.post('/preview', ctrl.requirePermission('upload'), handleUploadSingle, ctrl.previewUpload);
router.post('/recheck', ctrl.requirePermission('upload'), ctrl.recheckPreview);
router.post('/commit', ctrl.requirePermission('upload'), ctrl.commitBatch);

// Step 4-5: Saved Transactions, Edit, Soft Delete, Restore & Change Log / Import Batches
router.get('/transactions', ctrl.requirePermission('view'), ctrl.listTransactions);
router.put('/transactions/:id', ctrl.requirePermission('edit'), ctrl.updateTransaction);
router.delete('/transactions/:id', ctrl.requirePermission('delete'), ctrl.deleteTransaction);
router.post('/transactions/:id/restore', ctrl.requirePermission('delete'), ctrl.restoreTransaction);
router.post('/transactions/bulk-delete', ctrl.requirePermission('delete'), ctrl.bulkDeleteTransactions);
router.get('/batches', ctrl.requirePermission('view'), ctrl.getImportBatches);
router.delete('/batches/:batchId', ctrl.requirePermission('delete'), ctrl.deleteImportBatch);
router.post('/batches/:batchId/restore', ctrl.requirePermission('delete'), ctrl.restoreImportBatch);
router.get('/audit-logs', ctrl.requirePermission('view'), ctrl.getAuditLogs);

// Step 6: GST Working Paper & Invoice Matching / GSTR-2B
router.get('/gst-review', ctrl.requirePermission('view'), ctrl.getGstReview);
router.put('/gst-review/:txnId', ctrl.requirePermission('gstReview'), ctrl.updateGstReview);
router.get('/erp-invoices', ctrl.requirePermission('view'), ctrl.searchErpInvoices);
router.post('/gstr2b/import', ctrl.requirePermission('gstReview'), handleUploadSingle, ctrl.importGstr2b);

// Step 7: Excel Exports
router.get('/export/transactions', ctrl.requirePermission('view'), ctrl.exportTransactionsExcel);
router.get('/export/gst', ctrl.requirePermission('view'), ctrl.exportGstExcel);

module.exports = router;
