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
  console.log('Body avant sanitize:', JSON.stringify(req.body, null, 2));
  
  // ✅ 1. NORMALISER LES NOMS DE CHAMPS FRANÇAIS VERS ANGLAIS
  // Prénom / firstName
  if (req.body['Prénom'] || req.body['prénom']) {
    req.body.firstName = (req.body['Prénom'] || req.body['prénom']).trim();
    delete req.body['Prénom'];
    delete req.body['prénom'];
  }
  
  // Nom / lastName
  if (req.body['Nom de famille'] || req.body['NomDenom'] || req.body['nomDenom'] || req.body['Nom']) {
    req.body.lastName = (req.body['Nom de famille'] || req.body['NomDenom'] || req.body['nomDenom'] || req.body['Nom']).trim();
    delete req.body['Nom de famille'];
    delete req.body['NomDenom'];
    delete req.body['nomDenom'];
    delete req.body['Nom'];
  }
  
  // Email
  if (req.body['Email'] || req.body['email']) {
    req.body.email = (req.body['Email'] || req.body['email']).toLowerCase().trim();
    delete req.body['Email'];
  }
  
  // Mot de passe / password
  if (req.body['mot de passe'] || req.body['Mot de passe']) {
    req.body.password = req.body['mot de passe'] || req.body['Mot de passe'];
    delete req.body['mot de passe'];
    delete req.body['Mot de passe'];
  }
  
  // Rôle / role
  if (req.body['Rôle'] || req.body['rôle'] || req.body['role']) {
    req.body.role = (req.body['Rôle'] || req.body['rôle'] || req.body['role']).trim();
    delete req.body['Rôle'];
    delete req.body['rôle'];
  }
  
  // Date de naissance / dateOfBirth
  if (req.body['dateDeNaissance'] || req.body['DateDeNaissance'] || req.body['dateDeNaissance']) {
    req.body.dateOfBirth = req.body['dateDeNaissance'] || req.body['DateDeNaissance'];
    delete req.body['dateDeNaissance'];
    delete req.body['DateDeNaissance'];
  }
  
  // Genre / gender
  if (req.body['Genre'] || req.body['genre']) {
    let gender = (req.body['Genre'] || req.body['genre']).trim().toLowerCase();
    if (gender === 'homme' || gender === 'masculin') gender = 'male';
    if (gender === 'femme' || gender === 'féminin') gender = 'female';
    if (gender === 'autre') gender = 'other';
    req.body.gender = gender;
    delete req.body['Genre'];
    delete req.body['genre'];
  }
  
  // Téléphone / phoneNumber
  if (req.body['TéléphoneNuméro'] || req.body['NuméroDetéléphone'] || req.body['NuméroDeTéléphone'] || req.body['phoneNumber']) {
    req.body.phoneNumber = (req.body['TéléphoneNuméro'] || req.body['NuméroDetéléphone'] || req.body['NuméroDeTéléphone'] || req.body['phoneNumber']).trim();
    delete req.body['TéléphoneNuméro'];
    delete req.body['NuméroDetéléphone'];
    delete req.body['NuméroDeTéléphone'];
  }
  
  // Spécialité / specialty
  if (req.body['Spécialité'] || req.body['spécialité'] || req.body['specialty']) {
    req.body.specialty = (req.body['Spécialité'] || req.body['spécialité'] || req.body['specialty']).trim();
    delete req.body['Spécialité'];
    delete req.body['spécialité'];
  }
  
  // Numéro de licence / licenseNumber
  if (req.body['NuméroLicence'] || req.body['numéroLicence'] || req.body['licenseNumber']) {
    req.body.licenseNumber = (req.body['NuméroLicence'] || req.body['numéroLicence'] || req.body['licenseNumber']).trim();
    delete req.body['NuméroLicence'];
    delete req.body['numéroLicence'];
  }
  
  // Biographie / biography
  if (req.body['biographie'] || req.body['Biographie'] || req.body['biography']) {
    req.body.biography = (req.body['biographie'] || req.body['Biographie'] || req.body['biography']).trim();
    delete req.body['biographie'];
    delete req.body['Biographie'];
  }
  
  // Langues / languages
  if (req.body['langues'] || req.body['Langues'] || req.body['languages']) {
    req.body.languages = req.body['langues'] || req.body['Langues'] || req.body['languages'];
    delete req.body['langues'];
    delete req.body['Langues'];
  }
  
  // Groupe sanguin / bloodType
  if (req.body['groupeSanguin'] || req.body['GroupeSanguin'] || req.body['bloodType']) {
    req.body.bloodType = req.body['groupeSanguin'] || req.body['GroupeSanguin'] || req.body['bloodType'];
    delete req.body['groupeSanguin'];
    delete req.body['GroupeSanguin'];
  }

  // ✅ 2. NETTOYER LES CHAMPS ANGLAIS
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
  if (req.body.languages && !Array.isArray(req.body.languages)) {
    if (typeof req.body.languages === 'string') {
      try {
        req.body.languages = JSON.parse(req.body.languages);
      } catch (e) {
        req.body.languages = [req.body.languages];
      }
    } else {
      req.body.languages = [];
    }
  }

  console.log('Body après sanitize:', JSON.stringify(req.body, null, 2));
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
    .isIn(['male', 'female', 'other'])
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
    .isIn(['patient', 'doctor', 'admin', 'hospital_admin'])
    .withMessage('Rôle invalide'),
  body('specialty')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 0 })
    .withMessage('Spécialité invalide'),
  body('licenseNumber')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 0 })
    .withMessage('Numéro de licence invalide'),
  body('biography')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 0 })
    .withMessage('Biographie invalide'),
  body('languages')
    .optional({ nullable: true, checkFalsy: true })
    .isArray()
    .withMessage('Les langues doivent être un tableau')
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
