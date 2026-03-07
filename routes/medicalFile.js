const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { handleValidationErrors, sanitizeInput } = require('../middleware/validation');
const { MedicalFile, User } = require('../models');
const { logger } = require('../utils/logger');

// ✅ Importer le controller complet
const medicalFileController = require('../controllers/medicalFileController');

// ============================================
// VALIDATION RULES
// ============================================

const createMedicalFileValidation = [
  body('patientId').isUUID().withMessage('ID du patient invalide'),
  body('recordType').isIn([
    'consultation', 'lab_result', 'prescription', 'vaccination',
    'allergy', 'surgery', 'hospitalization', 'chronic_disease', 'family_history'
  ]).withMessage('Type de dossier invalide'),
  body('title').notEmpty().trim().withMessage('Titre requis'),
  body('consultationDate').isISO8601().toDate().withMessage('Date de consultation invalide'),
  body('description').optional().trim(),
  body('diagnosis').optional().trim(),
  body('nextAppointment').optional().isISO8601().toDate().withMessage('Date du prochain rendez-vous invalide'),
  body('isCritical').optional().isBoolean(),
  body('isShared').optional().isBoolean()
];

const updateMedicalFileValidation = [
  body('title').optional().notEmpty().trim(),
  body('description').optional().trim(),
  body('diagnosis').optional().trim(),
  body('nextAppointment').optional().isISO8601().toDate(),
  body('isCritical').optional().isBoolean(),
  body('isShared').optional().isBoolean()
];

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/medical-files
 * Récupérer les dossiers médicaux (query: ?patientId=xxx)
 */
router.get(
  '/',
  authenticateToken,
  authorizeRole('doctor', 'admin', 'patient'),
  async (req, res) => {
    try {
      const { patientId } = req.query;

      const where = {};
      if (patientId) {
        where.patientId = patientId;
      } else if (req.user.role === 'patient') {
        where.patientId = req.user.id;
      }

      const medicalFiles = await MedicalFile.findAll({
        where,
        include: [
          { model: User, as: 'patient', attributes: ['id', 'firstName', 'lastName'] },
          { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName'] }
        ],
        order: [['consultationDate', 'DESC']]
      });

      res.json({ success: true, data: medicalFiles });
    } catch (error) {
      logger.error('Erreur getMedicalFiles:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

/**
 * ✅ [CORRECTION] GET /api/medical-files/patient/:patientId
 * Récupérer les dossiers médicaux d'un patient spécifique
 * ⚠️ CETTE ROUTE MANQUAIT — C'est la cause du 404 !
 * ⚠️ Doit être AVANT /:id pour éviter le conflit de route
 */
router.get(
  '/patient/:patientId',
  authenticateToken,
  authorizeRole('doctor', 'admin', 'patient'),
  medicalFileController.getPatientMedicalFiles
);

/**
 * GET /api/medical-files/:id
 * Récupérer un dossier médical par ID
 */
router.get(
  '/:id',
  authenticateToken,
  authorizeRole('doctor', 'admin', 'patient'),
  medicalFileController.getMedicalFileById
);

/**
 * POST /api/medical-files
 * Créer un nouveau dossier médical (médecin ou admin)
 */
router.post(
  '/',
  authenticateToken,
  authorizeRole('doctor', 'admin'),
  sanitizeInput,
  createMedicalFileValidation,
  handleValidationErrors,
  medicalFileController.createMedicalRecord
);

/**
 * PUT /api/medical-files/:id
 * Mettre à jour un dossier médical
 */
router.put(
  '/:id',
  authenticateToken,
  authorizeRole('doctor', 'admin'),
  sanitizeInput,
  updateMedicalFileValidation,
  handleValidationErrors,
  medicalFileController.updateMedicalFile
);

/**
 * DELETE /api/medical-files/:id
 * Supprimer un dossier médical
 */
router.delete(
  '/:id',
  authenticateToken,
  authorizeRole('doctor', 'admin'),
  medicalFileController.deleteMedicalFile
);

module.exports = router;
