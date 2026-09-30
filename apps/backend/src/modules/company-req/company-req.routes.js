const express = require('express');
const router = express.Router();
const controller = require('./company-req.controller');

// Industry Master endpoints
router.get('/industries', controller.getDistinctIndustries);
router.post('/industries', controller.createIndustryType);

// List all company requirement records (search, sort, filter, pagination)
router.get('/', controller.getCompanyReqList);

// Get single record by ID
router.get('/:id', controller.getCompanyReqById);

// Create new record
router.post('/', controller.createCompanyReq);

// Update record
router.put('/:id', controller.updateCompanyReq);

// Delete record
router.delete('/:id', controller.deleteCompanyReq);

module.exports = router;
