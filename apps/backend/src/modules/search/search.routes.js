const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/auth.middleware');
const { search } = require('./search.controller');

router.use(authMiddleware);
router.get('/', search);

module.exports = router;
