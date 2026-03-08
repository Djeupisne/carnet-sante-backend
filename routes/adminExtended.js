// routes/adminExtended.js
// À monter dans server.js : app.use('/api/admin', require('./routes/adminExtended'));
const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { handleValidationErrors }           = require('../middleware/validation');
const ctrl = require('../controllers/adminExtendedController');

const adminOnly = [authenticateToken, authorizeRole('admin')];

// ── Prescriptions ─────────────────────────────────────────────────────────────
router.get('/prescriptions',  ...adminOnly, ctrl.getAllPrescriptions);

// ── Appels vidéo ──────────────────────────────────────────────────────────────
router.get('/video-calls',    ...adminOnly, ctrl.getAllVideoCalls);

// ── Revenus médecins ──────────────────────────────────────────────────────────
router.get('/doctor-earnings', ...adminOnly, ctrl.getDoctorEarnings);

// ── Paiements médecins ────────────────────────────────────────────────────────
router.get('/doctor-payments', ...adminOnly, ctrl.getDoctorPayments);

router.post('/doctor-payments',
  ...adminOnly,
  [
    body('doctorId').isUUID(),
    body('amount').isFloat({ min: 0.01 }),
    body('paymentMethod').isIn(['bank_transfer', 'mobile_money', 'cash', 'check'])
  ],
  handleValidationErrors,
  ctrl.createDoctorPayment
);

router.patch('/doctor-payments/:id/status',
  ...adminOnly,
  body('status').isIn(['pending','processing','completed','failed']),
  handleValidationErrors,
  ctrl.updatePaymentStatus
);

module.exports = router;
