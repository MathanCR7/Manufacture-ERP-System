const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/auth.middleware');
const { getLifecycle } = require('./qr-lifecycle.controller');

router.use(authMiddleware);
router.get('/:id', getLifecycle);

module.exports = router;
