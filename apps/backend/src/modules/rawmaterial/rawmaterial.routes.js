const express = require('express');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const rmController = require('./rawmaterial.controller');

const router = express.Router();

// --- RM PO Routes (/api/rm/...) ---
router.get('/rm/id/generate', authenticateToken, roleMiddleware(['PURCHASE_ACCOUNTANT', 'MAIN_MASTER']), rmController.generateRmId);
router.post('/rm/id/rotate', authenticateToken, roleMiddleware(['PURCHASE_ACCOUNTANT', 'MAIN_MASTER']), rmController.rotateRmId);

router.get('/rm/po', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER']), rmController.getPOs);
router.post('/rm/po', authenticateToken, roleMiddleware(['PURCHASE_ACCOUNTANT', 'MAIN_MASTER']), rmController.createPO);
router.get('/rm/po/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER']), rmController.getPOById);
router.put('/rm/po/:id', authenticateToken, roleMiddleware(['PURCHASE_ACCOUNTANT', 'MAIN_MASTER']), rmController.updatePO);
router.delete('/rm/po/:id', authenticateToken, roleMiddleware(['PURCHASE_ACCOUNTANT', 'MAIN_MASTER']), rmController.deletePO);

// --- UOM Routes (/api/uom) ---
router.get('/uom', authenticateToken, rmController.getUOMs);
router.post('/uom', authenticateToken, roleMiddleware(['MAIN_MASTER']), rmController.createUOM);

// --- RM Waste Routes (/api/rm-waste) ---
router.get('/rm-waste/reference/generate', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']), rmController.generateWasteReference);
router.get('/rm-waste', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']), rmController.getWastes);
router.post('/rm-waste', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']), rmController.createWaste);
router.get('/rm-waste/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']), rmController.getWasteById);
router.put('/rm-waste/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']), rmController.updateWaste);
router.delete('/rm-waste/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), rmController.deleteWaste);

// --- RM Stock Routes (/api/rm-stock) ---
router.get('/rm-stock', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER']), rmController.getStock);

module.exports = router;
