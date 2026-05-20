const express = require('express');
const router = express.Router();
const backupController = require('./backup.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/', backupController.getBackups);
router.get('/export', backupController.exportBackups);
router.post('/', backupController.createBackup);
router.post('/:filename/restore', backupController.restoreBackup);
router.delete('/:filename', backupController.deleteBackup);

module.exports = router;
