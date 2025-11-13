const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const appointmentController = require('../controllers/appointmentController');

// GET /api/appointments - Récupérer tous les rendez-vous de l'utilisateur
router.get('/', auth, appointmentController.getAppointments);

// GET /api/appointments/:id - Récupérer un rendez-vous spécifique
router.get('/:id', auth, appointmentController.getAppointmentById);

// POST /api/appointments - Créer un nouveau rendez-vous
router.post('/', auth, appointmentController.createAppointment);

// PATCH /api/appointments/:id/status - Mettre à jour le statut d'un rendez-vous
router.patch('/:id/status', auth, appointmentController.updateAppointmentStatus);

// PATCH /api/appointments/:id/cancel - Annuler un rendez-vous
router.patch('/:id/cancel', auth, appointmentController.cancelAppointment);

// PATCH /api/appointments/:id/confirm - Confirmer un rendez-vous
router.patch('/:id/confirm', auth, appointmentController.confirmAppointment);

// PATCH /api/appointments/:id/complete - Marquer un rendez-vous comme terminé
router.patch('/:id/complete', auth, appointmentController.completeAppointment);

// PATCH /api/appointments/:id/rate - Noter un rendez-vous
router.patch('/:id/rate', auth, appointmentController.rateAppointment);

module.exports = router;