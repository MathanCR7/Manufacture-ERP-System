const express = require('express');
const router = express.Router();
const controller = require('./product-spec-template.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

router.use(authMiddleware);

const allowedRoles = ['MAIN_MASTER', 'SUPERVISOR'];

router.get('/by-subcategory/:subcategoryId', roleMiddleware(allowedRoles), controller.getBySubcategoryId);
router.post('/', roleMiddleware(allowedRoles), controller.saveTemplate);
router.post('/duplicate', roleMiddleware(['MAIN_MASTER']), controller.duplicate);
router.get('/:subcategoryId/export-excel-format', roleMiddleware(allowedRoles), controller.exportExcel);

module.exports = router;
