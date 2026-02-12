const express = require('express');
const router = express.Router();
const { authenticateToken: protect } = require('../middleware/auth');
const {
  // Créneaux
  getAvailableSlots,
  getBookedSlots,
  
  // Rendez-vous
  createAppointment,
  getAppointments,
  // ⚠️ SUPPRIMEZ getAllAppointments - IL N'EXISTE PAS DANS VOTRE CONTROLLER !
  // getAllAppointments,  <-- À SUPPRIMER
  getAppointmentById,
  cancelAppointment,
  confirmAppointment,
  completeAppointment,
  rateAppointment,
  updateAppointmentStatus,
  
  // Statistiques
  // ⚠️ SUPPRIMEZ getDashboardStats - IL N'EXISTE PAS DANS VOTRE CONTROLLER !
  // getDashboardStats  <-- À SUPPRIMER
} = require('../controllers/appointmentController');

// ============================================
// ROUTES PUBLIQUES
// ============================================

// ✅ OK - Ces fonctions existent
router.get('/available-slots/:doctorId', getAvailableSlots);
router.get('/booked-slots/:doctorId', getBookedSlots);

// ============================================
// ROUTES PROTÉGÉES
// ============================================
router.use(protect);

// ✅ OK - Ces fonctions existent
router.post('/', createAppointment);
router.get('/', getAppointments);
router.get('/:id', getAppointmentById);
router.patch('/:id/cancel', cancelAppointment);
router.patch('/:id/confirm', confirmAppointment);
router.patch('/:id/complete', completeAppointment);
router.post('/:id/rate', rateAppointment);
router.patch('/:id/status', updateAppointmentStatus);

// ❌ SUPPRIMEZ CES ROUTES - Les fonctions n'existent pas !
// router.get('/all', getAllAppointments);  <-- À SUPPRIMER
// router.get('/dashboard/stats', getDashboardStats);  <-- À SUPPRIMER

module.exports = router;
