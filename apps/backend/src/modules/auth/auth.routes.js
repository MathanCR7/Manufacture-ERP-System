const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.post('/login', authController.login);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
