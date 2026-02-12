const express = require('express');
const router = express.Router();
const { authenticateToken: protect } = require('../middleware/auth');
const {
  getAvailableSlots,
  getBookedSlots,
  createAppointment,
  getAppointments,
  getAppointmentById,
  getAllAppointments,
  cancelAppointment,
  confirmAppointment,
  completeAppointment,
  getDashboardStats,
  getDoctors
} = require('../controllers/appointmentController');

// ============================================
// ROUTES PUBLIQUES (sans authentification)
// ============================================

/**
 * ✅ Récupérer les créneaux disponibles d'un médecin
 * GET /api/appointments/available-slots/:doctorId?date=YYYY-MM-DD
 */
router.get('/available-slots/:doctorId', getAvailableSlots);

/**
 * ✅ Récupérer les créneaux occupés d'un médecin
 * GET /api/appointments/booked-slots/:doctorId?date=YYYY-MM-DD
 */
router.get('/booked-slots/:doctorId', getBookedSlots);

/**
 * ✅ Récupérer la liste des médecins
 * GET /api/doctors
 */
router.get('/doctors', getDoctors);

// ============================================
// ROUTES PROTÉGÉES (authentification requise)
// ============================================
router.use(protect);

// ========== RENDEZ-VOUS ==========

/**
 * ✅ Créer un nouveau rendez-vous
 * POST /api/appointments
 */
router.post('/appointments', createAppointment);

/**
 * ✅ Récupérer tous les rendez-vous de l'utilisateur connecté
 * GET /api/appointments
 */
router.get('/appointments', getAppointments);

/**
 * ✅ Récupérer TOUS les rendez-vous (admin/doctor)
 * GET /api/appointments/all
 */
router.get('/appointments/all', getAllAppointments);

/**
 * ✅ Récupérer un rendez-vous par ID
 * GET /api/appointments/:id
 */
router.get('/appointments/:id', getAppointmentById);

/**
 * ✅ Annuler un rendez-vous
 * PATCH /api/appointments/:id/cancel
 */
router.patch('/appointments/:id/cancel', cancelAppointment);

/**
 * ✅ Confirmer un rendez-vous (médecin)
 * PATCH /api/appointments/:id/confirm
 */
router.patch('/appointments/:id/confirm', confirmAppointment);

/**
 * ✅ Marquer un rendez-vous comme terminé (médecin)
 * PATCH /api/appointments/:id/complete
 */
router.patch('/appointments/:id/complete', completeAppointment);

// ========== STATISTIQUES ==========

/**
 * ✅ Récupérer les statistiques du dashboard
 * GET /api/dashboard/stats
 */
router.get('/dashboard/stats', getDashboardStats);

module.exports = router;
