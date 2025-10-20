const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const paymentController = require('../controllers/paymentController');
const { handleValidationErrors, sanitizeInput } = require('../middleware/validation');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Validation rules
const createPaymentValidation = [
  body('appointmentId').isUUID().withMessage('ID de rendez-vous invalide'),
  body('amount').isFloat({ min: 0 }).withMessage('Montant invalide'),
  body('paymentMethod').isIn(['card', 'mobile_money', 'bank_transfer', 'cash']).withMessage('Méthode de paiement invalide')
];

const processPaymentValidation = [
  body('status').isIn(['pending', 'completed', 'failed', 'refunded']).withMessage('Statut de paiement invalide')
];

// Routes
router.post(
  '/',
  authenticateToken,
  sanitizeInput,
  createPaymentValidation,
  handleValidationErrors,
  paymentController.createPayment
);

router.post(
  '/:paymentId/process',
  authenticateToken,
  sanitizeInput,
  processPaymentValidation,
  handleValidationErrors,
  paymentController.processPayment
);

router.get(
  '/history',
  authenticateToken,
  paymentController.getPaymentHistory
);

router.get(
  '/:id',
  authenticateToken,
  paymentController.getPaymentById
);

router.post(
  '/:id/refund',
  authenticateToken,
  authorizeRole('admin'),
  paymentController.refundPayment
);

module.exports = router;