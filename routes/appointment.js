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
} = require('../controllers/appointmentController');

// ============================================
// ROUTES PUBLIQUES (sans authentification)
// ============================================

/**
 * GET /api/appointments/available-slots/:doctorId?date=YYYY-MM-DD
 * Créneaux disponibles d'un médecin
 */
router.get('/available-slots/:doctorId', getAvailableSlots);

/**
 * GET /api/appointments/booked-slots/:doctorId?date=YYYY-MM-DD
 * Créneaux occupés d'un médecin
 */
router.get('/booked-slots/:doctorId', getBookedSlots);

// ============================================
// ROUTES PROTÉGÉES (authentification requise)
// ============================================
router.use(protect);

/**
 * POST /api/appointments
 * Créer un nouveau rendez-vous (patient)
 */
router.post('/', createAppointment);

/**
 * GET /api/appointments/all
 * Tous les rendez-vous sans filtre (admin)
 * ⚠️ CRITIQUE : doit être AVANT /:id
 */
router.get('/all', getAllAppointments);

/**
 * GET /api/appointments?filter=upcoming|past|all
 * Rendez-vous de l'utilisateur connecté
 */
router.get('/', getAppointments);

/**
 * GET /api/appointments/:id
 * Récupérer un rendez-vous par son ID
 * ⚠️ Toujours en DERNIER parmi les GET
 */
router.get('/:id', getAppointmentById);

/**
 * PATCH /api/appointments/:id/cancel
 * Annuler un rendez-vous (patient ou médecin)
 */
router.patch('/:id/cancel', cancelAppointment);

/**
 * PATCH /api/appointments/:id/confirm
 * Confirmer un rendez-vous (médecin)
 */
router.patch('/:id/confirm', confirmAppointment);

/**
 * PATCH /api/appointments/:id/complete
 * Marquer un rendez-vous comme terminé (médecin)
 */
router.patch('/:id/complete', completeAppointment);

/**
 * POST /api/appointments/:id/rate
 * Noter un rendez-vous (patient)
 */
router.post('/:id/rate', rateAppointment);

module.exports = router;
