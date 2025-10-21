const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { 
  handleValidationErrors, 
  sanitizeInput,
  registerValidation,
  loginValidation,
  resetPasswordValidation,
  forgotPasswordValidation
} = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');

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
  forgotPasswordValidation,
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