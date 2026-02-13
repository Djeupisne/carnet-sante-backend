// CORRECTION : Import depuis models/index.js et Op inclus
const { Appointment, User, Payment, AuditLog, Op, sequelize } = require('../models');
const { validationService } = require('../services/validationService');

// ✅ CORRIGÉ: IMPORT DIRECT, PAS DE DESTRUCTURATION !
const notificationService = require('../services/notificationService');
const { v4: uuidv4 } = require('uuid');

// ============================================
// GESTION DES CRÉNEAUX
// ============================================

/**
 * ✅ Générer les créneaux par défaut
 */
const generateDefaultSlots = () => {
  const slots = [];
  for (let hour = 8; hour <= 17; hour++) {
    if (hour !== 12) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }
  return slots;
};

/**
 * ✅ Formater une date
 */
const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * ✅ Formater une heure
 */
const formatTime = (date) => {
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

/**
 * ✅ Récupérer les créneaux disponibles d'un médecin
 */
const getAvailableSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    console.log(`📅 Récupération des créneaux disponibles pour le médecin ${doctorId}...`);

    const doctor = await User.findOne({
      where: { id: doctorId, role: 'doctor', isActive: true }
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Médecin non trouvé'
      });
    }

    // ✅ TOUJOURS retourner des créneaux par défaut
    let availableSlots = generateDefaultSlots();
    let bookedSlots = [];

    if (date) {
      const bookedAppointments = await Appointment.findAll({
        where: {
          doctorId,
          status: { [Op.notIn]: ['cancelled', 'completed'] },
          [Op.and]: sequelize.where(
            sequelize.fn('DATE', sequelize.col('appointmentDate')),
            '=',
            date
          )
        }
      });

      bookedSlots = bookedAppointments.map(apt => formatTime(apt.appointmentDate));
      availableSlots = availableSlots.filter(slot => !bookedSlots.includes(slot));
    }

    res.json({
      success: true,
      data: {
        availableSlots,
        bookedSlots,
        total: availableSlots.length,
        date: date || null,
        doctorId,
        doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`
      }
    });

  } catch (error) {
    console.error('❌ Erreur getAvailableSlots:', error);
    res.json({
      success: true,
      data: {
        availableSlots: generateDefaultSlots(),
        bookedSlots: [],
        total: generateDefaultSlots().length,
        date: req.query.date || null,
        doctorId: req.params.doctorId
      }
    });
  }
};

/**
 * ✅ Récupérer les créneaux occupés d'un médecin
 */
const getBookedSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    console.log(`📅 Récupération des créneaux occupés pour le médecin ${doctorId}...`);

    const whereClause = {
      doctorId,
      status: { [Op.in]: ['pending', 'confirmed'] }
    };

    if (date) {
      whereClause.appointmentDate = {
        [Op.between]: [
          new Date(new Date(date).setHours(0, 0, 0, 0)),
          new Date(new Date(date).setHours(23, 59, 59, 999))
        ]
      };
    }

    const appointments = await Appointment.findAll({
      where: whereClause,
      attributes: ['id', 'appointmentDate', 'duration', 'status'],
      include: [{
        model: User,
        as: 'patient',
        attributes: ['id', 'firstName', 'lastName']
      }]
    });

    const bookedSlots = appointments.map(apt => formatTime(apt.appointmentDate));

    res.json({
      success: true,
      data: {
        bookedSlots,
        total: bookedSlots.length,
        date: date || null,
        doctorId
      }
    });

  } catch (error) {
    console.error('❌ Erreur getBookedSlots:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ============================================
// GESTION DES RENDEZ-VOUS
// ============================================

/**
 * ✅ Créer un nouveau rendez-vous
 */
const createAppointment = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const {
      doctorId,
      appointmentDate,
      duration = 30,
      type = 'in_person',
      reason,
      symptoms = []
    } = req.body;

    const patientId = req.user.id;

    console.log(`📝 Création d'un nouveau rendez-vous pour le patient ${patientId}...`);

    if (!doctorId || !appointmentDate || !reason) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Données manquantes: doctorId, appointmentDate et reason sont requis'
      });
    }

    const doctor = await User.findOne({
      where: { 
        id: doctorId, 
        role: 'doctor',
        isActive: true 
      }
    });

    if (!doctor) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Médecin non trouvé ou non actif'
      });
    }

    // ✅ Vérifier si le créneau est déjà réservé
    const dateStr = formatDate(appointmentDate);
    const timeStr = formatTime(appointmentDate);

    const existingAppointment = await Appointment.findOne({
      where: {
        doctorId,
        status: { [Op.notIn]: ['cancelled', 'completed'] },
        [Op.and]: [
          sequelize.where(
            sequelize.fn('DATE', sequelize.col('appointmentDate')),
            '=',
            dateStr
          ),
          sequelize.where(
            sequelize.fn('TO_CHAR', sequelize.col('appointmentDate'), 'HH24:MI'),
            '=',
            timeStr
          )
        ]
      }
    });

    if (existingAppointment) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: 'Ce créneau est déjà réservé. Veuillez en choisir un autre.'
      });
    }

    // ✅ Créer le rendez-vous
    const appointment = await Appointment.create({
      id: uuidv4(),
      patientId,
      doctorId,
      appointmentDate: new Date(appointmentDate),
      duration,
      type,
      reason,
      symptoms,
      status: 'pending'
    }, { transaction });

    await transaction.commit();

    // ✅ Récupérer le rendez-vous avec les associations
    const newAppointment = await Appointment.findByPk(appointment.id, {
      include: [
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'specialty', 'consultationPrice']
        }
      ]
    });

    // ✅ NOTIFICATION - VERSION ROBUSTE
    try {
      if (notificationService && typeof notificationService.createNotification === 'function') {
        const patientFirstName = req.user?.firstName || 'Patient';
        const patientLastName = req.user?.lastName || '';
        
        await notificationService.createNotification({
          userId: doctorId,
          type: 'new_appointment',
          title: 'Nouveau rendez-vous',
          message: `Nouveau rendez-vous avec ${patientFirstName} ${patientLastName} le ${new Date(appointmentDate).toLocaleDateString('fr-FR')} à ${timeStr}`,
          data: { 
            appointmentId: appointment.id,
            patientName: `${patientFirstName} ${patientLastName}`.trim(),
            date: appointmentDate,
            time: timeStr
          }
        });
        console.log('✅ Notification créée avec succès');
      } else {
        console.warn('⚠️ Service de notification non disponible');
      }
    } catch (notifError) {
      console.error('❌ Erreur notification:', notifError.message);
      // ✅ NE PAS BLOQUER LE RENDEZ-VOUS
    }

    // ✅ AUDIT LOG
    try {
      await AuditLog.create({
        action: 'APPOINTMENT_CREATED',
        userId: patientId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: {
          appointmentId: appointment.id,
          doctorId,
          appointmentDate,
          time: timeStr
        }
      });
    } catch (auditError) {
      console.warn('⚠️ Erreur audit log:', auditError.message);
    }

    console.log(`✅ Rendez-vous créé avec succès: ${newAppointment.id}`);

    res.status(201).json({
      success: true,
      message: 'Rendez-vous créé avec succès',
      data: newAppointment
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Erreur création rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création du rendez-vous',
      error: error.message
    });
  }
};

/**
 * ✅ Récupérer tous les rendez-vous
 */
const getAppointments = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, filter = 'all' } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`📋 Récupération des rendez-vous pour ${userRole} ${userId} (filtre: ${filter})...`);

    let whereClause = {};
    
    if (userRole === 'patient') {
      whereClause.patientId = userId;
    } else if (userRole === 'doctor') {
      whereClause.doctorId = userId;
    }

    // ✅ FILTRES PAR DATE
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (filter === 'upcoming') {
      whereClause = {
        ...whereClause,
        appointmentDate: { [Op.gte]: now },
        status: { [Op.notIn]: ['cancelled', 'completed', 'no_show'] }
      };
    } else if (filter === 'past') {
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { appointmentDate: { [Op.lt]: now } },
          { status: { [Op.in]: ['cancelled', 'completed', 'no_show'] } }
        ]
      };
    }

    if (status) whereClause.status = status;
    if (type) whereClause.type = type;

    const offset = (page - 1) * limit;

    const includeConfig = [
      {
        model: User,
        as: userRole === 'doctor' ? 'patient' : 'doctor',
        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'specialty']
      }
    ];

    const orderBy = filter === 'past' 
      ? [['appointmentDate', 'DESC']]
      : [['appointmentDate', 'ASC']];

    const { count, rows: appointments } = await Appointment.findAndCountAll({
      where: whereClause,
      include: includeConfig,
      order: orderBy,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    console.log(`✅ ${appointments.length} rendez-vous trouvés`);

    res.json({
      success: true,
      data: appointments,
      count: appointments.length,
      filter,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(count / limit),
        totalRecords: count
      }
    });

  } catch (error) {
    console.error('❌ Erreur getAppointments:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * ✅ Récupérer un rendez-vous par ID
 */
const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`📋 Récupération du rendez-vous ${id}...`);

    let whereCondition = { id };
    
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
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'specialty', 'consultationPrice']
        }
      ]
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }

    res.json({
      success: true,
      data: appointment
    });

  } catch (error) {
    console.error('❌ Erreur getAppointmentById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * ✅ Annuler un rendez-vous
 */
const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`❌ Annulation du rendez-vous ${id}...`);

    let whereCondition = { id };
    
    if (userRole === 'patient') {
      whereCondition.patientId = userId;
    } else if (userRole === 'doctor') {
      whereCondition.doctorId = userId;
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
      cancellationReason: cancellationReason || `Annulé par le ${userRole === 'doctor' ? 'médecin' : 'patient'}`,
      cancelledAt: new Date()
    });

    // ✅ NOTIFICATION
    const notificationUserId = userRole === 'patient' ? appointment.doctorId : appointment.patientId;
    
    try {
      if (notificationService && typeof notificationService.createNotification === 'function') {
        await notificationService.createNotification({
          userId: notificationUserId,
          type: 'appointment_cancelled',
          title: 'Rendez-vous annulé',
          message: `Le rendez-vous du ${new Date(appointment.appointmentDate).toLocaleDateString('fr-FR')} a été annulé.`,
          data: { appointmentId: appointment.id }
        });
      }
    } catch (notifError) {
      console.warn('⚠️ Erreur notification:', notifError.message);
    }

    console.log(`✅ Rendez-vous ${id} annulé avec succès`);

    res.json({
      success: true,
      message: 'Rendez-vous annulé avec succès',
      data: appointment
    });

  } catch (error) {
    console.error('❌ Erreur cancelAppointment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * ✅ Confirmer un rendez-vous (médecin)
 */
const confirmAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`✅ Confirmation du rendez-vous ${id}...`);

    const appointment = await Appointment.findByPk(id, {
      include: [
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }

    if (appointment.doctorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Seuls les rendez-vous en attente peuvent être confirmés'
      });
    }

    await appointment.update({
      status: 'confirmed',
      confirmedAt: new Date()
    });

    // ✅ NOTIFICATION AU PATIENT
    try {
      if (notificationService && typeof notificationService.createNotification === 'function') {
        await notificationService.createNotification({
          userId: appointment.patientId,
          type: 'appointment_confirmed',
          title: '✅ Rendez-vous confirmé',
          message: `Votre rendez-vous avec Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} le ${new Date(appointment.appointmentDate).toLocaleDateString('fr-FR')} est confirmé.`,
          data: { appointmentId: appointment.id }
        });
      }
    } catch (notifError) {
      console.warn('⚠️ Erreur notification:', notifError.message);
    }

    console.log(`✅ Rendez-vous ${id} confirmé`);

    res.json({
      success: true,
      message: 'Rendez-vous confirmé avec succès',
      data: appointment
    });

  } catch (error) {
    console.error('❌ Erreur confirmAppointment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * ✅ Marquer un rendez-vous comme terminé
 */
const completeAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    console.log(`✅ Finalisation du rendez-vous ${id}...`);

    const appointment = await Appointment.findByPk(id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }

    if (req.user.role !== 'doctor' || appointment.doctorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    await appointment.update({ 
      status: 'completed',
      notes: notes || appointment.notes,
      completedAt: new Date()
    });

    // ✅ NOTIFICATION AU PATIENT
    try {
      if (notificationService && typeof notificationService.createNotification === 'function') {
        await notificationService.createNotification({
          userId: appointment.patientId,
          type: 'appointment_completed',
          title: 'Rendez-vous terminé',
          message: `Votre rendez-vous du ${new Date(appointment.appointmentDate).toLocaleDateString('fr-FR')} est terminé.`,
          data: { appointmentId: appointment.id }
        });
      }
    } catch (notifError) {
      console.warn('⚠️ Erreur notification:', notifError.message);
    }

    console.log(`✅ Rendez-vous ${id} terminé`);

    res.json({
      success: true,
      message: 'Rendez-vous marqué comme terminé',
      data: appointment
    });
    
  } catch (error) {
    console.error('❌ Erreur completeAppointment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * ✅ Noter un rendez-vous
 */
const rateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { rating, feedback } = req.body;

    console.log(`⭐ Notation du rendez-vous ${id}...`);

    const appointment = await Appointment.findOne({
      where: { 
        id, 
        patientId: userId,
        status: 'completed'
      }
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
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

    console.log(`✅ Rendez-vous ${id} noté: ${rating}/5`);

    res.json({
      success: true,
      message: 'Rendez-vous noté avec succès',
      data: appointment
    });

  } catch (error) {
    console.error('❌ Erreur rateAppointment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ✅ EXPORT
module.exports = {
  getAvailableSlots,
  getBookedSlots,
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  cancelAppointment,
  confirmAppointment,
  completeAppointment,
  rateAppointment
};
