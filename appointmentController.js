const { Appointment, User } = require('../models');
const { Op } = require('sequelize');

/**
 * ✅ Récupérer les créneaux disponibles d'un médecin pour une date
 * GET /api/appointments/available-slots/:doctorId
 */
const getAvailableSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query; // Format: YYYY-MM-DD
    
    console.log('🕐 Récupération des créneaux disponibles:', { doctorId, date });
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'La date est requise'
      });
    }

    // Vérifier que le médecin existe
    const doctor = await User.findOne({
      where: { id: doctorId, role: 'doctor' }
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Médecin introuvable'
      });
    }

    // Définir les créneaux de base (à personnaliser selon vos besoins)
    const allSlots = [
      '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
    ];

    // Récupérer les rendez-vous du médecin pour cette date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedAppointments = await Appointment.findAll({
      where: {
        doctorId: doctorId,
        appointmentDate: {
          [Op.between]: [startOfDay, endOfDay]
        },
        status: {
          [Op.notIn]: ['cancelled', 'no_show']
        }
      }
    });

    console.log('📅 Rendez-vous réservés trouvés:', bookedAppointments.length);

    // Extraire les heures réservées
    const bookedSlots = bookedAppointments.map(apt => {
      const time = new Date(apt.appointmentDate);
      const hours = String(time.getHours()).padStart(2, '0');
      const minutes = String(time.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    });

    console.log('🚫 Créneaux occupés:', bookedSlots);

    // Filtrer les créneaux disponibles
    const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));
    
    console.log('✅ Créneaux disponibles:', availableSlots);

    res.json({
      success: true,
      data: {
        availableSlots,
        bookedSlots,
        totalSlots: allSlots.length,
        availableCount: availableSlots.length
      }
    });

  } catch (error) {
    console.error('❌ Erreur getAvailableSlots:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des créneaux disponibles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * ✅ Récupérer uniquement les créneaux occupés d'un médecin pour une date
 * GET /api/appointments/booked-slots/:doctorId
 */
const getBookedSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query; // Format: YYYY-MM-DD
    
    console.log('🚫 Récupération des créneaux occupés:', { doctorId, date });
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'La date est requise'
      });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedAppointments = await Appointment.findAll({
      where: {
        doctorId: doctorId,
        appointmentDate: {
          [Op.between]: [startOfDay, endOfDay]
        },
        status: {
          [Op.notIn]: ['cancelled', 'no_show']
        }
      }
    });

    const bookedSlots = bookedAppointments.map(apt => {
      const time = new Date(apt.appointmentDate);
      const hours = String(time.getHours()).padStart(2, '0');
      const minutes = String(time.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    });

    console.log('✅ Créneaux occupés récupérés:', bookedSlots);

    res.json({
      success: true,
      data: {
        bookedSlots,
        count: bookedSlots.length
      }
    });

  } catch (error) {
    console.error('❌ Erreur getBookedSlots:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des créneaux occupés',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Créer un nouveau rendez-vous
 * POST /api/appointments
 */
const createAppointment = async (req, res) => {
  try {
    const { doctorId, appointmentDate, duration = 30, type = 'in_person', reason, notes } = req.body;
    const patientId = req.user.id;

    console.log('📅 Création d\'un rendez-vous:', {
      patientId,
      doctorId,
      appointmentDate,
      duration,
      type
    });

    // Vérifier que le médecin existe
    const doctor = await User.findOne({
      where: { id: doctorId, role: 'doctor' }
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Médecin introuvable'
      });
    }

    // ✅ Vérifier que le créneau n'est pas déjà pris
    const appointmentTime = new Date(appointmentDate);
    const existingAppointment = await Appointment.findOne({
      where: {
        doctorId: doctorId,
        appointmentDate: appointmentTime,
        status: {
          [Op.notIn]: ['cancelled', 'no_show']
        }
      }
    });

    if (existingAppointment) {
      return res.status(409).json({
        success: false,
        message: 'Ce créneau est déjà réservé',
        field: 'appointmentDate'
      });
    }

    // Créer le rendez-vous
    const appointment = await Appointment.create({
      patientId,
      doctorId,
      appointmentDate: appointmentTime,
      duration,
      status: 'pending',
      type,
      reason: reason || null,
      notes: notes || null
    });

    console.log('✅ Rendez-vous créé:', appointment.id);

    // Récupérer le rendez-vous avec les relations
    const createdAppointment = await Appointment.findByPk(appointment.id, {
      include: [
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'specialty']
        },
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Rendez-vous créé avec succès',
      data: {
        appointment: createdAppointment
      }
    });

  } catch (error) {
    console.error('❌ Erreur createAppointment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du rendez-vous',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Récupérer tous les rendez-vous de l'utilisateur
 * GET /api/appointments
 */
const getAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log('📋 Récupération des rendez-vous pour:', { userId, userRole });

    let whereClause = {};
    
    // Si patient, récupérer ses rendez-vous
    if (userRole === 'patient') {
      whereClause = { patientId: userId };
    } 
    // Si médecin, récupérer les rendez-vous de ses patients
    else if (userRole === 'doctor') {
      whereClause = { doctorId: userId };
    }

    const appointments = await Appointment.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'specialty']
        },
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName', 'phoneNumber']
        }
      ],
      order: [['appointmentDate', 'DESC']]
    });

    console.log('✅ Rendez-vous récupérés:', appointments.length);

    res.json({
      success: true,
      data: {
        appointments,
        count: appointments.length
      }
    });

  } catch (error) {
    console.error('❌ Erreur getAppointments:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des rendez-vous',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Annuler un rendez-vous
 * PATCH /api/appointments/:id/cancel
 */
const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous introuvable'
      });
    }

    // Vérifier que l'utilisateur a le droit d'annuler
    if (appointment.patientId !== userId && appointment.doctorId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à annuler ce rendez-vous'
      });
    }

    await appointment.update({
      status: 'cancelled',
      notes: reason ? `Annulé: ${reason}` : 'Annulé'
    });

    console.log('✅ Rendez-vous annulé:', id);

    res.json({
      success: true,
      message: 'Rendez-vous annulé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur cancelAppointment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation du rendez-vous',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAvailableSlots,
  getBookedSlots,
  createAppointment,
  getAppointments,
  cancelAppointment
};
