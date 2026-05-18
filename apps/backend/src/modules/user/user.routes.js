const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

// Profile routes - any authenticated user
router.get('/profile', authMiddleware, userController.getProfile);
router.patch('/profile', authMiddleware, userController.updateProfile);
router.post('/request-password-change', authMiddleware, userController.requestPasswordChange);

// Admin-only user management
router.get('/', authMiddleware, roleMiddleware(['MAIN_MASTER']), userController.getAllUsers);
router.post('/', authMiddleware, roleMiddleware(['MAIN_MASTER']), userController.createUser);
router.patch('/:id', authMiddleware, roleMiddleware(['MAIN_MASTER']), userController.updateUser);
router.delete('/:id', authMiddleware, roleMiddleware(['MAIN_MASTER']), userController.deactivateUser);

module.exports = router;
