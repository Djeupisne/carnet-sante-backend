// routes/prescriptions.js
const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { handleValidationErrors }           = require('../middleware/validation');
const ctrl = require('../controllers/prescriptionController');

// ─── Validation ──────────────────────────────────────────────────────────────
const createValidation = [
  body('patientId').isUUID().withMessage('patientId invalide'),
  body('medications').isArray({ min: 1 }).withMessage('Au moins un médicament requis'),
  body('medications.*.medication').notEmpty().withMessage('Nom du médicament requis'),
  body('medications.*.dosage').notEmpty().withMessage('Posologie requise'),
  body('notes').optional().isString(),
  body('validUntil').optional().isISO8601().toDate()
];

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/prescriptions — mes prescriptions (patient = les siennes, médecin = celles créées)
router.get('/',
  authenticateToken,
  authorizeRole('patient', 'doctor', 'admin'),
  ctrl.getMyPrescriptions
);

// GET /api/prescriptions/patient/:patientId — toutes les prescriptions d'un patient
router.get('/patient/:patientId',
  authenticateToken,
  authorizeRole('patient', 'doctor', 'admin'),
  ctrl.getPatientPrescriptions
);

// GET /api/prescriptions/:id — détail
router.get('/:id',
  authenticateToken,
  authorizeRole('patient', 'doctor', 'admin'),
  ctrl.getPrescriptionById
);

// POST /api/prescriptions — créer (médecin seulement)
router.post('/',
  authenticateToken,
  authorizeRole('doctor', 'admin'),
  createValidation,
  handleValidationErrors,
  ctrl.createPrescription
);

// PATCH /api/prescriptions/:id/status — changer le statut
router.patch('/:id/status',
  authenticateToken,
  authorizeRole('doctor', 'admin'),
  body('status').isIn(['active', 'completed', 'cancelled']),
  handleValidationErrors,
  ctrl.updatePrescriptionStatus
);

// DELETE /api/prescriptions/:id
router.delete('/:id',
  authenticateToken,
  authorizeRole('doctor', 'admin'),
  ctrl.deletePrescription
);

module.exports = router;
