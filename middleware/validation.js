const { validationResult, body } = require('express-validator');
const { logger } = require('../utils/logger');

/**
 * Middleware pour gérer les erreurs de validation
 */
const handleValidationErrors = (req, res, next) => {
  console.log('\n🔍 === MIDDLEWARE VALIDATION ===');
  
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    console.log('Erreurs de validation détectées:');
    const formattedErrors = errors.array().map(err => {
      console.log(`  - ${err.param}: ${err.msg}`);
      return {
        field: err.param,
        message: err.msg,
        value: err.value
      };
    });

    logger.warn('Erreurs de validation', {
      errors: formattedErrors,
      path: req.path
    });

    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: formattedErrors
    });
  }

  console.log('✓ Validation réussie');
  next();
};

/**
 * Middleware pour nettoyer et normaliser les inputs
 */
const sanitizeInput = (req, res, next) => {
  console.log('\n🧹 === MIDDLEWARE SANITIZE ===');
  console.log('Body avant sanitize:', req.body);

  // Nettoyer les strings
  if (req.body.firstName && typeof req.body.firstName === 'string') {
    req.body.firstName = req.body.firstName.trim();
  }
  if (req.body.lastName && typeof req.body.lastName === 'string') {
    req.body.lastName = req.body.lastName.trim();
  }
  if (req.body.email && typeof req.body.email === 'string') {
    req.body.email = req.body.email.toLowerCase().trim();
  }
  if (req.body.phoneNumber && typeof req.body.phoneNumber === 'string') {
    req.body.phoneNumber = req.body.phoneNumber.trim();
  }

  console.log('Body après sanitize:', req.body);
  next();
};

/**
 * Règles de validation pour l'enregistrement
 * Modifiées pour être plus flexibles
 */
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caractères'),
  
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Prénom requis')
    .isLength({ min: 2 })
    .withMessage('Le prénom doit contenir au moins 2 caractères'),
  
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Nom requis')
    .isLength({ min: 2 })
    .withMessage('Le nom doit contenir au moins 2 caractères'),
  
  body('dateOfBirth')
    .notEmpty()
    .withMessage('Date de naissance requise')
    .isISO8601()
    .withMessage('Format de date invalide (YYYY-MM-DD)'),
  
  body('gender')
    .notEmpty()
    .withMessage('Genre requis')
    .isIn(['male', 'female', 'other'])
    .withMessage('Genre invalide (male, female, other)'),
  
  body('phoneNumber')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^\+?[\d\s\-\(\)]{10,}$/)
    .withMessage('Format de numéro de téléphone invalide'),
  
  body('role')
    .optional({ checkFalsy: true })
    .isIn(['patient', 'doctor', 'admin', 'hospital_admin'])
    .withMessage('Rôle invalide')
];

/**
 * Règles de validation pour la connexion
 */
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide'),
  
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Mot de passe requis')
];

/**
 * Règles de validation pour la réinitialisation de mot de passe
 */
const resetPasswordValidation = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('Token requis'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caractères')
];

/**
 * Règles de validation pour la demande de réinitialisation
 */
const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide')
];

module.exports = {
  handleValidationErrors,
  sanitizeInput,
  registerValidation,
  loginValidation,
  resetPasswordValidation,
  forgotPasswordValidation
};