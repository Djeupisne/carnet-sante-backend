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
  getAllAppointments,      // ✅ AJOUTÉ - Existe dans le controller
  getAppointmentById,
  cancelAppointment,
  confirmAppointment,
  completeAppointment,
  rateAppointment,
  // ❌ SUPPRIMÉ - N'existe pas
  // updateAppointmentStatus,
} = require('../controllers/appointmentController');

// ============================================
// ROUTES PUBLIQUES
// ============================================
router.get('/available-slots/:doctorId', getAvailableSlots);
router.get('/booked-slots/:doctorId', getBookedSlots);

// ============================================
// ROUTES PROTÉGÉES
// ============================================
router.use(protect);

router.post('/', createAppointment);
router.get('/', getAppointments);
router.get('/all', getAllAppointments);      // ✅ ROUTE AJOUTÉE
router.get('/:id', getAppointmentById);
router.patch('/:id/cancel', cancelAppointment);
router.patch('/:id/confirm', confirmAppointment);
router.patch('/:id/complete', completeAppointment);
router.post('/:id/rate', rateAppointment);

module.exports = router;
