const express = require('express');
const router = express.Router();
const { TaxController } = require('./tax.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Public route to get setup settings if needed, or put behind auth
router.get('/', TaxController.getSettings);
router.post('/', authMiddleware, TaxController.saveSettings);

module.exports = router;
