const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { handleValidationErrors, sanitizeInput } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

// ✅ [CORRECTION] Utiliser authenticateToken (pas authenticate qui n'existe pas)
const authenticate = authenticateToken;

// ============================================
// ✅ [CORRECTION] Configuration multer
// Dossier en minuscules 'uploads' (cohérent avec app.js statique)
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // ✅ CORRECTION : 'uploads' minuscule partout pour Linux (Render est case-sensitive)
    const dir = path.join(__dirname, '..', 'uploads', 'profiles');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.user.id}-${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées (jpeg, jpg, png, gif)'));
    }
  }
});

// ============================================
// VALIDATION RULES
// ============================================

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

const preferencesValidation = [
  body('preferences.language').optional().isIn(['fr', 'en', 'es', 'de']),
  body('preferences.theme').optional().isIn(['light', 'dark']),
  body('preferences.notifications.email').optional().isBoolean(),
  body('preferences.notifications.sms').optional().isBoolean(),
  body('preferences.notifications.push').optional().isBoolean()
];

const emergencyContactValidation = [
  body('name').optional().notEmpty().trim(),
  body('phone').optional().isMobilePhone(),
  body('relationship').optional().trim()
];

// ============================================
// ROUTES DE BASE
// ============================================

router.get('/', authenticate, profileController.getProfile);

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

router.get('/dashboard', authenticate, profileController.getDashboardStats);

// ============================================
// ROUTES PRÉFÉRENCES
// ============================================

router.get('/preferences', authenticate, profileController.getPreferences);

router.patch('/preferences',
  authenticate,
  sanitizeInput,
  preferencesValidation,
  handleValidationErrors,
  profileController.updatePreferences
);

// ============================================
// ROUTES PHOTO DE PROFIL
// ============================================

/**
 * POST /api/profile/picture
 * ✅ upload.single('profilePicture') utilise maintenant le bon dossier
 */
router.post('/picture',
  authenticate,
  upload.single('profilePicture'),
  profileController.uploadProfilePicture
);

router.delete('/picture', authenticate, profileController.deleteProfilePicture);

// ============================================
// ROUTES CONTACT D'URGENCE
// ============================================

router.get('/emergency-contact', authenticate, profileController.getEmergencyContact);

router.put('/emergency-contact',
  authenticate,
  sanitizeInput,
  emergencyContactValidation,
  handleValidationErrors,
  profileController.updateEmergencyContact
);

// ============================================
// ROUTES HISTORIQUE ET EXPORT
// ============================================

router.get('/login-history', authenticate, profileController.getLoginHistory);

router.post('/deactivate', authenticate, profileController.deactivateAccount);

router.get('/export-data', authenticate, profileController.exportPersonalData);

module.exports = router;
