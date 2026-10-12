const express = require('express');
const multer = require('multer');
const controller = require('./finance.controller');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max per file
});

router.get('/expenses', controller.getExpenses);
router.post('/expenses', controller.createExpense);
router.post('/expenses/bulk', controller.createBulkExpenses);
router.post('/expenses/bulk-delete', controller.deleteBulkExpenses);
router.get('/expenses/summary', controller.getExpensesSummary);

// Attachments upload and removal
router.post('/expenses/upload-attachments', upload.array('files', 10), controller.uploadExpenseAttachments);
router.delete('/expenses/attachments', controller.removeExpenseAttachmentFile);

router.put('/expenses/:id', controller.updateExpense);
router.delete('/expenses/:id', controller.deleteExpense);

module.exports = router;
