const express = require('express');
const PartiesController = require('./parties.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Allow MAIN_MASTER, SUPERVISOR, and PURCHASE_ACCOUNTANT to access parties
const allowedRoles = ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'];

router.post('/customers', roleMiddleware(allowedRoles), PartiesController.createCustomer);
router.get('/customers', roleMiddleware(allowedRoles), PartiesController.getCustomers);
router.get('/customers/:id', roleMiddleware(allowedRoles), PartiesController.getCustomerById);
router.put('/customers/:id', roleMiddleware(allowedRoles), PartiesController.updateCustomer);
router.delete('/customers/:id', roleMiddleware(['MAIN_MASTER']), PartiesController.deleteCustomer); // Only Master can delete

router.post('/suppliers', roleMiddleware(allowedRoles), PartiesController.createSupplier);
router.get('/suppliers', roleMiddleware(allowedRoles), PartiesController.getSuppliers);
router.get('/suppliers/:id', roleMiddleware(allowedRoles), PartiesController.getSupplierById);
router.put('/suppliers/:id', roleMiddleware(allowedRoles), PartiesController.updateSupplier);
router.delete('/suppliers/:id', roleMiddleware(['MAIN_MASTER']), PartiesController.deleteSupplier); // Only Master can delete

module.exports = router;
