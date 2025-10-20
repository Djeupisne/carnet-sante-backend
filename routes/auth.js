const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const { handleValidationErrors, sanitizeInput } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
  body('firstName').notEmpty().trim().withMessage('Prénom requis'),
  body('lastName').notEmpty().trim().withMessage('Nom requis'),
  body('dateOfBirth').isDate().withMessage('Date de naissance invalide'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Genre invalide'),
  body('phoneNumber').optional().isMobilePhone().withMessage('Numéro de téléphone invalide')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').notEmpty().withMessage('Mot de passe requis')
];

const resetPasswordValidation = [
  body('token').notEmpty().withMessage('Token requis'),
  body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères')
];

// Routes
router.post('/register', 
  sanitizeInput,
  registerValidation,
  handleValidationErrors,
  authController.register
);

router.post('/login',
  sanitizeInput,
  loginValidation,
  handleValidationErrors,
  authController.login
);

router.post('/forgot-password',
  sanitizeInput,
  [body('email').isEmail().normalizeEmail().withMessage('Email invalide')],
  handleValidationErrors,
  authController.forgotPassword
);

router.post('/reset-password',
  sanitizeInput,
  resetPasswordValidation,
  handleValidationErrors,
  authController.resetPassword
);

router.post('/logout',
  authenticate,
  authController.logout
);

router.get('/me',
  authenticate,
  authController.getCurrentUser
);

module.exports = router;