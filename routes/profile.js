const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { handleValidationErrors, sanitizeInput } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');

// Configuration multer pour l'upload de photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/profiles';
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

// Routes existantes
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

// ============================================
// ✅ NOUVELLES ROUTES POUR LES PRÉFÉRENCES
// ============================================

/**
 * GET /api/profile/preferences
 * Récupérer les préférences de l'utilisateur
 */
router.get('/preferences',
  authenticate,
  profileController.getPreferences
);

/**
 * PATCH /api/profile/preferences
 * Mettre à jour les préférences de l'utilisateur
 */
router.patch('/preferences',
  authenticate,
  sanitizeInput,
  preferencesValidation,
  handleValidationErrors,
  profileController.updatePreferences
);

// ============================================
// ✅ NOUVELLES ROUTES POUR LA PHOTO DE PROFIL
// ============================================

/**
 * POST /api/profile/picture
 * Uploader une photo de profil
 */
router.post('/picture',
  authenticate,
  upload.single('profilePicture'),
  profileController.uploadProfilePicture
);

/**
 * DELETE /api/profile/picture
 * Supprimer la photo de profil
 */
router.delete('/picture',
  authenticate,
  profileController.deleteProfilePicture
);

// ============================================
// ✅ NOUVELLES ROUTES POUR LE CONTACT D'URGENCE
// ============================================

/**
 * GET /api/profile/emergency-contact
 * Récupérer le contact d'urgence
 */
router.get('/emergency-contact',
  authenticate,
  profileController.getEmergencyContact
);

/**
 * PUT /api/profile/emergency-contact
 * Mettre à jour le contact d'urgence
 */
router.put('/emergency-contact',
  authenticate,
  sanitizeInput,
  emergencyContactValidation,
  handleValidationErrors,
  profileController.updateEmergencyContact
);

// ============================================
// ✅ NOUVELLES ROUTES POUR L'HISTORIQUE ET EXPORT
// ============================================

/**
 * GET /api/profile/login-history
 * Récupérer l'historique des connexions
 */
router.get('/login-history',
  authenticate,
  profileController.getLoginHistory
);

/**
 * POST /api/profile/deactivate
 * Désactiver le compte
 */
router.post('/deactivate',
  authenticate,
  profileController.deactivateAccount
);

/**
 * GET /api/profile/export-data
 * Exporter toutes les données personnelles
 */
router.get('/export-data',
  authenticate,
  profileController.exportPersonalData
);

module.exports = router;
