const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/auth.middleware');
const controller = require('./attendance.controller');

router.use(authMiddleware);

router.post('/check-in', controller.checkIn);
router.post('/check-out', controller.checkOut);
router.get('/status', controller.getStatus);
router.get('/my', controller.getMyLogs);
router.get('/all', controller.getAllLogs);
router.get('/users', controller.getAllUsers);

module.exports = router;
