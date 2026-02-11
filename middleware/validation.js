const { validationResult, body } = require('express-validator');
const { logger } = require('../utils/logger');

const handleValidationErrors = (req, res, next) => {
  console.log('\n🔍 === MIDDLEWARE VALIDATION ===');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Erreurs de validation détectées:');
    const formattedErrors = errors.array().map(err => {
      console.log(`  - ${err.param}: ${err.msg}`);
      return {
        field: err.param || 'unknown',
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

const sanitizeInput = (req, res, next) => {
  console.log('\n🧹 === MIDDLEWARE SANITIZE ===');
  console.log('Body avant sanitize:', req.body);
  
  // ✅ UNIQUEMENT nettoyer, JAMAIS ajouter des valeurs par défaut !
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
  if (req.body.specialty && typeof req.body.specialty === 'string') {
    req.body.specialty = req.body.specialty.trim();
  }
  if (req.body.licenseNumber && typeof req.body.licenseNumber === 'string') {
    req.body.licenseNumber = req.body.licenseNumber.trim();
  }
  if (req.body.biography && typeof req.body.biography === 'string') {
    req.body.biography = req.body.biography.trim();
  }

  // ✅ BLOC SUPPRIMÉ - PLUS AUCUNE VALEUR PAR DÉFAUT AUTOMATIQUE !

  console.log('Body après sanitize:', req.body);
  next();
};

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
    .isIn(['male', 'female', 'other', 'homme', 'femme', 'autre', 'masculin', 'féminin'])
    .withMessage('Genre invalide'),
  body('phoneNumber')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^\+?[0-9\s\-\(\)\.]{8,20}$/)
    .withMessage('Format de numéro de téléphone invalide'),
  body('bloodType')
    .optional({ checkFalsy: true })
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Groupe sanguin invalide'),
  body('role')
    .optional()
    .isIn(['patient', 'doctor', 'admin', 'hospital_admin', 'docteur', 'médecin'])
    .withMessage('Rôle invalide'),
  body('specialty')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 0 })
    .optional()
    .withMessage('Spécialité invalide'),
  body('licenseNumber')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 0 })
    .optional()
    .withMessage('Numéro de licence invalide'),
  body('biography')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 0 })
    .optional()
    .withMessage('Biographie invalide'),
  body('languages')
    .optional({ nullable: true, checkFalsy: true })
    .isArray()
    .optional()
    .withMessage('Les langues doivent être un tableau')
    .custom((value) => true),
  body('prénom').custom((value, { req }) => {
    if (value && !req.body.firstName) req.body.firstName = value;
    return true;
  }),
  body('NomDenom').custom((value, { req }) => {
    if (value && !req.body.lastName) req.body.lastName = value;
    return true;
  }),
  body('spécialité').custom((value, { req }) => {
    if (value && !req.body.specialty) req.body.specialty = value;
    return true;
  }),
  body('NuméroLicence').custom((value, { req }) => {
    if (value && !req.body.licenseNumber) req.body.licenseNumber = value;
    return true;
  }),
  body('biographie').custom((value, { req }) => {
    if (value && !req.body.biography) req.body.biography = value;
    return true;
  }),
  body('langues').custom((value, { req }) => {
    if (value && !req.body.languages) req.body.languages = value;
    return true;
  }),
  body('dateDeNaissance').custom((value, { req }) => {
    if (value && !req.body.dateOfBirth) req.body.dateOfBirth = value;
    return true;
  }),
  body('rôle').custom((value, { req }) => {
    if (value && !req.body.role) req.body.role = value;
    return true;
  }),
  body('NuméroDeTéléphone').custom((value, { req }) => {
    if (value && !req.body.phoneNumber) req.body.phoneNumber = value;
    return true;
  }),
  body('groupeSanguin').custom((value, { req }) => {
    if (value && !req.body.bloodType) req.body.bloodType = value;
    return true;
  })
];

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

const resetPasswordValidation = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('Token requis'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caractères')
];

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
