const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const appointmentController = require('../controllers/appointmentController');
const { handleValidationErrors, sanitizeInput } = require('../middleware/validation');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Validation rules
const createAppointmentValidation = [
  body('doctorId').isUUID().withMessage('ID du médecin invalide'),
  body('appointmentDate').isISO8601().withMessage('Date de rendez-vous invalide'),
  body('duration').optional().isInt({ min: 15, max: 240 }).withMessage('Durée invalide'),
  body('type').isIn(['in_person', 'teleconsultation', 'home_visit']).withMessage('Type de rendez-vous invalide'),
  body('reason').notEmpty().trim().withMessage('Motif requis')
];

const updateStatusValidation = [
  body('status').isIn(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']).withMessage('Statut invalide'),
  body('cancellationReason').optional().trim()
];

// Routes
router.post(
  '/',
  authenticateToken,
  sanitizeInput,
  createAppointmentValidation,
  handleValidationErrors,
  appointmentController.createAppointment
);

router.get(
  '/',
  authenticateToken,
  appointmentController.getAppointments
);

router.get(
  '/:id',
  authenticateToken,
  appointmentController.getAppointmentById
);

router.patch(
  '/:id/status',
  authenticateToken,
  sanitizeInput,
  updateStatusValidation,
  handleValidationErrors,
  appointmentController.updateAppointmentStatus
);

router.post(
  '/:id/complete',
  authenticateToken,
  authorizeRole('doctor'),
  appointmentController.completeAppointment
);

module.exports = router;