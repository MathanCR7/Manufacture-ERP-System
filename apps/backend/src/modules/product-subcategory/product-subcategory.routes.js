const express = require('express');
const router = express.Router();
const controller = require('./product-subcategory.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

router.use(authMiddleware);

const allowedRoles = ['MAIN_MASTER', 'SUPERVISOR'];

router.get('/', roleMiddleware(allowedRoles), controller.getAll);
router.get('/:id', roleMiddleware(allowedRoles), controller.getById);
router.post('/', roleMiddleware(allowedRoles), controller.create);
router.put('/:id', roleMiddleware(allowedRoles), controller.update);
router.delete('/:id', roleMiddleware(['MAIN_MASTER']), controller.delete);

module.exports = router;
