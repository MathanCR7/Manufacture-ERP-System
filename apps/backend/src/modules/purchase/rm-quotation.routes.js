const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/auth.middleware');
const {
  getAllQuotations,
  getQuotationById,
  createQuotation,
  getPublicQuotation,
  submitPublicQuotation,
  requestResubmission,
  resendSupplierLink
} = require('./rm-quotation.controller');

// Public Supplier Form Endpoints (Un-authenticated)
router.get('/public/:quotationId/:token', getPublicQuotation);
router.post('/public/:quotationId/:token/submit', submitPublicQuotation);
router.post('/public/:quotationId/:token/request-resubmission', requestResubmission);

// Internal Authenticated Endpoints
router.use(authMiddleware);
router.get('/', getAllQuotations);
router.get('/:id', getQuotationById);
router.post('/', createQuotation);
router.post('/:id/resend-supplier-link', resendSupplierLink);

module.exports = router;
