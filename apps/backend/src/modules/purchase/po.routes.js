const express = require('express');
const router = express.Router();
const poController = require('./po.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/', poController.getAllPOs);
router.get('/reference/generate', poController.generateReference);
router.get('/:id', poController.getPOById);
router.post('/', poController.createPO);

module.exports = router;
