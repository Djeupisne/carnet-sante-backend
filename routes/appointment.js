const express = require('express');
const router = express.Router();
const { authenticateToken: protect } = require('../middleware/auth');
const {
  getAvailableSlots,
  getBookedSlots,
  createAppointment,
  getAppointments,
  cancelAppointment
} = require('../controllers/appointmentController'); // ✅ CORRIGÉ !

// Routes publiques (ou semi-publiques)
// ✅ Récupérer les créneaux disponibles d'un médecin
router.get('/available-slots/:doctorId', getAvailableSlots);

// ✅ Récupérer les créneaux occupés d'un médecin
router.get('/booked-slots/:doctorId', getBookedSlots);

// Routes protégées (authentification requise)
router.use(protect);

// Créer un rendez-vous
router.post('/', createAppointment);

// Récupérer tous les rendez-vous de l'utilisateur
router.get('/', getAppointments);

// Annuler un rendez-vous
router.patch('/:id/cancel', cancelAppointment);

// Confirmer un rendez-vous (pour les médecins)
router.patch('/:id/confirm', async (req, res) => {
  try {
    const { Appointment } = require('../models');
    const { id } = req.params;
    
    const appointment = await Appointment.findByPk(id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous introuvable'
      });
    }
    
    // Vérifier que l'utilisateur est le médecin
    if (appointment.doctorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé'
      });
    }
    
    await appointment.update({ status: 'confirmed' });
    
    res.json({
      success: true,
      message: 'Rendez-vous confirmé'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Marquer comme terminé
router.patch('/:id/complete', async (req, res) => {
  try {
    const { Appointment } = require('../models');
    const { id } = req.params;
    const { notes } = req.body;
    
    const appointment = await Appointment.findByPk(id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous introuvable'
      });
    }
    
    // Vérifier que l'utilisateur est le médecin
    if (appointment.doctorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé'
      });
    }
    
    await appointment.update({ 
      status: 'completed',
      notes: notes || appointment.notes
    });
    
    res.json({
      success: true,
      message: 'Rendez-vous marqué comme terminé'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

module.exports = router;
