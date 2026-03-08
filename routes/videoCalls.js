// routes/videoCalls.js
const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { handleValidationErrors }           = require('../middleware/validation');
const ctrl = require('../controllers/videoCallController');

// GET /api/video-calls — historique
router.get('/',
  authenticateToken,
  authorizeRole('patient', 'doctor', 'admin'),
  ctrl.getMyVideoCalls
);

// GET /api/video-calls/patient/:patientId
router.get('/patient/:patientId',
  authenticateToken,
  authorizeRole('patient', 'doctor', 'admin'),
  ctrl.getPatientVideoCalls
);

// POST /api/video-calls — médecin crée l'appel
router.post('/',
  authenticateToken,
  authorizeRole('doctor', 'admin'),
  [
    body('patientId').isUUID().withMessage('patientId invalide'),
    body('roomLink').isURL().withMessage('roomLink invalide')
  ],
  handleValidationErrors,
  ctrl.createVideoCall
);

// PATCH /api/video-calls/:id/start
router.patch('/:id/start',
  authenticateToken,
  authorizeRole('doctor', 'admin'),
  ctrl.startVideoCall
);

// PATCH /api/video-calls/:id/end
router.patch('/:id/end',
  authenticateToken,
  authorizeRole('doctor', 'admin'),
  ctrl.endVideoCall
);

module.exports = router;
