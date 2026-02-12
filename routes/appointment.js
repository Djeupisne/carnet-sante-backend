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
  getAllAppointments,
  getAppointmentById,
  cancelAppointment,
  confirmAppointment,
  completeAppointment,
  rateAppointment,
  
  // Statistiques
  getDashboardStats
} = require('../controllers/appointmentController');

// ============================================
// ROUTES PUBLIQUES (sans authentification)
// ============================================

/**
 * ✅ Récupérer les créneaux disponibles
 * GET /api/appointments/available-slots/:doctorId?date=YYYY-MM-DD
 */
router.get('/available-slots/:doctorId', getAvailableSlots);

/**
 * ✅ Récupérer les créneaux réservés
 * GET /api/appointments/booked-slots/:doctorId?date=YYYY-MM-DD
 */
router.get('/booked-slots/:doctorId', getBookedSlots);

// ============================================
// ROUTES PROTÉGÉES (authentification requise)
// ============================================
router.use(protect);

/**
 * ✅ Créer un rendez-vous
 * POST /api/appointments
 */
router.post('/', createAppointment);

/**
 * ✅ Récupérer les rendez-vous (avec filtre)
 * GET /api/appointments?filter=upcoming|past|all
 */
router.get('/', getAppointments);

/**
 * ✅ Récupérer TOUS les rendez-vous (admin/doctor)
 * GET /api/appointments/all
 */
router.get('/all', getAllAppointments);

/**
 * ✅ Récupérer un rendez-vous par ID
 * GET /api/appointments/:id
 */
router.get('/:id', getAppointmentById);

/**
 * ✅ Annuler un rendez-vous
 * PATCH /api/appointments/:id/cancel
 */
router.patch('/:id/cancel', cancelAppointment);

/**
 * ✅ Confirmer un rendez-vous (médecin)
 * PATCH /api/appointments/:id/confirm
 */
router.patch('/:id/confirm', confirmAppointment);

/**
 * ✅ Marquer comme terminé (médecin)
 * PATCH /api/appointments/:id/complete
 */
router.patch('/:id/complete', completeAppointment);

/**
 * ✅ Noter un rendez-vous (patient)
 * POST /api/appointments/:id/rate
 */
router.post('/:id/rate', rateAppointment);

/**
 * ✅ Mettre à jour le statut
 * PATCH /api/appointments/:id/status
 */
router.patch('/:id/status', updateAppointmentStatus);

// ============================================
// STATISTIQUES
// ============================================

/**
 * ✅ Statistiques dashboard
 * GET /api/dashboard/stats
 */
router.get('/dashboard/stats', getDashboardStats);

module.exports = router;
