const express = require('express');
const router = express.Router();
const { Appointment } = require('../models/Appointment');
const { User } = require('../models/User');
const { auth } = require('../middleware/auth');

// GET /api/appointments - Récupérer tous les rendez-vous de l'utilisateur
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    console.log(`📋 Récupération des rendez-vous pour l'utilisateur ${userId} (${userRole})...`);

    let whereCondition = {};
    
    if (userRole === 'patient') {
      whereCondition.patientId = userId;
    } else if (userRole === 'doctor') {
      whereCondition.doctorId = userId;
    }
    // Les admins voient tous les rendez-vous

    const appointments = await Appointment.findAll({
      where: whereCondition,
      include: [
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'dateOfBirth', 'gender']
        },
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'specialty', 'licenseNumber', 'biography', 'consultationPrice', 'languages']
        }
      ],
      order: [['appointmentDate', 'DESC']]
    });

    console.log(`✅ ${appointments.length} rendez-vous trouvés`);

    res.json({
      success: true,
      data: appointments,
      count: appointments.length
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des rendez-vous',
      error: error.message
    });
  }
});

// GET /api/appointments/:id - Récupérer un rendez-vous spécifique
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    console.log(`📋 Récupération du rendez-vous ${id}...`);

    let whereCondition = { id };
    
    // Les patients ne peuvent voir que leurs propres rendez-vous
    // Les médecins ne peuvent voir que les rendez-vous où ils sont le médecin
    if (userRole === 'patient') {
      whereCondition.patientId = userId;
    } else if (userRole === 'doctor') {
      whereCondition.doctorId = userId;
    }

    const appointment = await Appointment.findOne({
      where: whereCondition,
      include: [
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'dateOfBirth', 'gender']
        },
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'specialty', 'licenseNumber', 'biography', 'consultationPrice', 'languages']
        }
      ]
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }

    console.log(`✅ Rendez-vous trouvé pour le ${appointment.appointmentDate}`);
    
    res.json({
      success: true,
      data: appointment
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération du rendez-vous',
      error: error.message
    });
  }
});

// POST /api/appointments - Créer un nouveau rendez-vous
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { doctorId, appointmentDate, duration, type, reason } = req.body;
    
    console.log(`📝 Création d'un nouveau rendez-vous pour le patient ${userId}...`);

    // Validation des données
    if (!doctorId || !appointmentDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Données manquantes: doctorId, appointmentDate et reason sont requis'
      });
    }

    // Vérifier que le médecin existe et est actif
    const doctor = await User.findOne({
      where: { 
        id: doctorId, 
        role: 'doctor',
        isActive: true 
      }
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Médecin non trouvé ou non actif'
      });
    }

    const appointment = await Appointment.create({
      patientId: userId,
      doctorId,
      appointmentDate: new Date(appointmentDate),
      duration: duration || 30,
      type: type || 'in_person',
      reason,
      status: 'pending'
    });

    // Charger les données associées
    const newAppointment = await Appointment.findByPk(appointment.id, {
      include: [
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'dateOfBirth', 'gender']
        },
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'specialty', 'licenseNumber', 'biography', 'consultationPrice', 'languages']
        }
      ]
    });

    console.log(`✅ Rendez-vous créé avec succès: ${newAppointment.id}`);
    
    res.status(201).json({
      success: true,
      message: 'Rendez-vous créé avec succès',
      data: newAppointment
    });

  } catch (error) {
    console.error('❌ Erreur lors de la création du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création du rendez-vous',
      error: error.message
    });
  }
});

// PATCH /api/appointments/:id/cancel - Annuler un rendez-vous
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { cancellationReason } = req.body;
    
    console.log(`❌ Annulation du rendez-vous ${id}...`);

    let whereCondition = { id };
    
    if (req.user.role === 'patient') {
      whereCondition.patientId = userId;
    }

    const appointment = await Appointment.findOne({ where: whereCondition });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Le rendez-vous est déjà annulé'
      });
    }

    await appointment.update({
      status: 'cancelled',
      cancellationReason: cancellationReason || 'Annulé par le patient'
    });

    console.log(`✅ Rendez-vous ${id} annulé avec succès`);
    
    res.json({
      success: true,
      message: 'Rendez-vous annulé avec succès',
      data: appointment
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'annulation du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'annulation du rendez-vous',
      error: error.message
    });
  }
});

// PATCH /api/appointments/:id/confirm - Confirmer un rendez-vous
router.patch('/:id/confirm', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`✅ Confirmation du rendez-vous ${id}...`);

    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Seuls les rendez-vous en attente peuvent être confirmés'
      });
    }

    await appointment.update({
      status: 'confirmed'
    });

    console.log(`✅ Rendez-vous ${id} confirmé avec succès`);
    
    res.json({
      success: true,
      message: 'Rendez-vous confirmé avec succès',
      data: appointment
    });

  } catch (error) {
    console.error('❌ Erreur lors de la confirmation du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la confirmation du rendez-vous',
      error: error.message
    });
  }
});

// PATCH /api/appointments/:id/rate - Noter un rendez-vous
router.patch('/:id/rate', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { rating, feedback } = req.body;
    
    console.log(`⭐ Notation du rendez-vous ${id}...`);

    const appointment = await Appointment.findOne({
      where: { 
        id, 
        patientId: userId,
        status: 'completed' // Ne peut noter que les rendez-vous terminés
      }
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé ou non éligible à la notation'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'La note doit être entre 1 et 5'
      });
    }

    await appointment.update({
      rating,
      feedback: feedback || null
    });

    console.log(`✅ Rendez-vous ${id} noté avec succès: ${rating} étoiles`);
    
    res.json({
      success: true,
      message: 'Rendez-vous noté avec succès',
      data: appointment
    });

  } catch (error) {
    console.error('❌ Erreur lors de la notation du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la notation du rendez-vous',
      error: error.message
    });
  }
});

module.exports = router;