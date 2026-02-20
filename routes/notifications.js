const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Routes utilisateur
router.get('/', notificationController.getUserNotifications);
router.patch('/:id/read', notificationController.markAsRead);
router.post('/read-all', notificationController.markAllAsRead);
router.get('/unread-count', notificationController.getUnreadCount);
router.get('/stats', notificationController.getStats);

// Routes admin uniquement
router.post('/test-reminder/:appointmentId', 
  authorizeRole('admin'), 
  notificationController.testReminder
);

router.post('/scheduler/toggle', 
  authorizeRole('admin'), 
  notificationController.toggleScheduler
);

module.exports = router;
