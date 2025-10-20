const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { handleValidationErrors, sanitizeInput } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');

// Validation rules
const updateProfileValidation = [
  body('firstName').optional().notEmpty().trim(),
  body('lastName').optional().notEmpty().trim(),
  body('phoneNumber').optional().isMobilePhone(),
  body('dateOfBirth').optional().isDate(),
  body('bloodType').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
];

const changePasswordValidation = [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
];

// Routes
router.get('/',
  authenticate,
  profileController.getProfile
);

router.put('/',
  authenticate,
  sanitizeInput,
  updateProfileValidation,
  handleValidationErrors,
  profileController.updateProfile
);

router.patch('/change-password',
  authenticate,
  sanitizeInput,
  changePasswordValidation,
  handleValidationErrors,
  profileController.changePassword
);

router.get('/dashboard',
  authenticate,
  profileController.getDashboardStats
);

module.exports = router;