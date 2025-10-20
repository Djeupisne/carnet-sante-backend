const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Toutes les routes admin nécessitent une authentification et le rôle admin
router.use(authenticateToken);
router.use(authorizeRole('admin'));

// Routes
router.get('/dashboard', adminController.getDashboardStats);
router.get('/users', adminController.getUsers);
router.patch('/users/:userId/status', adminController.updateUserStatus);
router.get('/audit-logs', adminController.getAuditLogs);
router.get('/financial/reports', adminController.getFinancialReports);

module.exports = router;