const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { handleValidationErrors, sanitizeInput } = require('../middleware/validation');
const { MedicalFile, User } = require('../models');
const { logger } = require('../utils/logger');

// Validation rules
const createMedicalFileValidation = [
  body('patientId').isUUID().withMessage('ID du patient invalide'),
  body('recordType').isIn([
    'consultation',
    'lab_result',
    'prescription',
    'vaccination',
    'allergy',
    'surgery',
    'hospitalization',
    'chronic_disease',
    'family_history'
  ]).withMessage('Type de dossier invalide'),
  body('title').notEmpty().trim().withMessage('Titre requis'),
  body('consultationDate').isISO8601().toDate().withMessage('Date de consultation invalide'),
  body('description').optional().trim(),
  body('diagnosis').optional().trim(),
  body('symptoms').optional().isJSON().withMessage('Les symptômes doivent être au format JSON'),
  body('medications').optional().isJSON().withMessage('Les médicaments doivent être au format JSON'),
  body('labResults').optional().isJSON().withMessage('Les résultats de laboratoire doivent être au format JSON'),
  body('vitalSigns').optional().isJSON().withMessage('Les signes vitaux doivent être au format JSON'),
  body('attachments').optional().isJSON().withMessage('Les pièces jointes doivent être au format JSON'),
  body('nextAppointment').optional().isISO8601().toDate().withMessage('Date du prochain rendez-vous invalide'),
  body('isCritical').optional().isBoolean().withMessage('isCritical doit être un booléen'),
  body('isShared').optional().isBoolean().withMessage('isShared doit être un booléen')
];

// Contrôleur pour récupérer les dossiers médicaux
const getMedicalFiles = async (req, res) => {
  try {
    console.log('\n📋 === GET MEDICAL FILES ===');
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
      ]
    });

    logger.info('Récupération des dossiers médicaux', {
      userId: req.user.id,
      patientId: patientId || 'tous'
    });

    res.json({
      success: true,
      message: 'Dossiers médicaux récupérés',
      data: medicalFiles
    });
  } catch (error) {
    console.error('\n❌ Erreur getMedicalFiles:', error.message);
    logger.error('Erreur lors de la récupération des dossiers médicaux', {
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// Contrôleur pour créer un dossier médical
const createMedicalFile = async (req, res) => {
  try {
    console.log('\n📝 === CREATE MEDICAL FILE ===');
    const {
      patientId,
      recordType,
      title,
      description,
      diagnosis,
      symptoms,
      medications,
      labResults,
      vitalSigns,
      attachments,
      consultationDate,
      nextAppointment,
      isCritical,
      isShared
    } = req.body;

    // Vérifier que le patient existe
    const patient = await User.findByPk(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient non trouvé'
      });
    }

    // Créer le dossier médical
    const medicalFile = await MedicalFile.create({
      patientId,
      doctorId: req.user.id,
      recordType,
      title,
      description,
      diagnosis,
      symptoms,
      medications,
      labResults,
      vitalSigns,
      attachments,
      consultationDate,
      nextAppointment,
      isCritical: isCritical || false,
      isShared: isShared || false,
      accessLog: [{ userId: req.user.id, action: 'created', timestamp: new Date() }]
    });

    logger.info('Dossier médical créé', {
      userId: req.user.id,
      patientId,
      medicalFileId: medicalFile.id
    });

    res.status(201).json({
      success: true,
      message: 'Dossier médical créé avec succès',
      data: medicalFile
    });
  } catch (error) {
    console.error('\n❌ Erreur createMedicalFile:', error.message);
    logger.error('Erreur lors de la création du dossier médical', {
      error: error.message,
      userId: req.user.id
    });

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// Routes
router.get(
  '/',
  authenticateToken,
  authorizeRole('doctor', 'admin', 'patient'),
  getMedicalFiles
);

router.post(
  '/',
  authenticateToken,
  authorizeRole('doctor', 'admin'),
  sanitizeInput,
  createMedicalFileValidation,
  handleValidationErrors,
  createMedicalFile
);

module.exports = router;