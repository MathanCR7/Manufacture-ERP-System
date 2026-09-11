const express = require('express');
const router = express.Router();
const controller = require('./finance.controller');

router.get('/expenses', controller.getExpenses);
router.post('/expenses', controller.createExpense);
router.post('/expenses/bulk', controller.createBulkExpenses);
router.post('/expenses/bulk-delete', controller.deleteBulkExpenses);
router.get('/expenses/summary', controller.getExpensesSummary);
router.put('/expenses/:id', controller.updateExpense);
router.delete('/expenses/:id', controller.deleteExpense);

module.exports = router;
