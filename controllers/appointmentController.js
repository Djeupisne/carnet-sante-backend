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
 * ✅ Générer les créneaux par défaut (8h-17h, sauf 12h)
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
 * ✅ Formater une date en YYYY-MM-DD
 */
const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * ✅ Formater une date en HH:MM
 */
const formatTime = (date) => {
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

/**
 * ✅ Récupérer les créneaux disponibles d'un médecin
 * GET /available-slots/:doctorId?date=YYYY-MM-DD
 */
const getAvailableSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    console.log(`📅 Récupération des créneaux disponibles pour le médecin ${doctorId}...`);

    // Vérifier que le médecin existe
    const doctor = await User.findOne({
      where: { id: doctorId, role: 'doctor', isActive: true }
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Médecin non trouvé'
      });
    }

    // ✅ FORCER DES CRÉNEAUX PAR DÉFAUT - TOUJOURS DISPONIBLES
    let availableSlots = generateDefaultSlots();
    let bookedSlots = [];

    if (date) {
      // Récupérer les créneaux déjà réservés pour cette date
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
      
      // Filtrer les créneaux disponibles
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
    console.error('❌ Erreur lors de la récupération des créneaux disponibles:', error);
    
    // ✅ TOUJOURS retourner des créneaux, même en cas d'erreur
    res.json({
      success: true,
      data: {
        availableSlots: generateDefaultSlots(),
        bookedSlots: [],
        total: generateDefaultSlots().length,
        date: req.query.date || null,
        doctorId: req.params.doctorId,
        message: 'Créneaux par défaut (erreur serveur)'
      }
    });
  }
};

/**
 * ✅ Récupérer les créneaux occupés d'un médecin
 * GET /booked-slots/:doctorId?date=YYYY-MM-DD
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
    console.error('❌ Erreur lors de la récupération des créneaux occupés:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des créneaux occupés',
      error: error.message
    });
  }
};

// ============================================
// GESTION DES RENDEZ-VOUS
// ============================================

/**
 * ✅ Créer un nouveau rendez-vous
 * POST /appointments
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

    // Validation
    if (!doctorId || !appointmentDate || !reason) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Données manquantes: doctorId, appointmentDate et reason sont requis'
      });
    }

    // Vérifier que le médecin existe
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

    // ✅ VÉRIFICATION CRITIQUE : Créneau déjà réservé ?
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

    // Créer le rendez-vous
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

    // Récupérer le rendez-vous avec les associations
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

    // Audit log
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
      console.warn('⚠️ Erreur lors de la création du log d\'audit:', auditError.message);
    }

    console.log(`✅ Rendez-vous créé avec succès: ${newAppointment.id} le ${dateStr} à ${timeStr}`);

    res.status(201).json({
      success: true,
      message: 'Rendez-vous créé avec succès',
      data: newAppointment
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Erreur lors de la création du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création du rendez-vous',
      error: error.message
    });
  }
};

/**
 * ✅ Récupérer TOUS les rendez-vous (sans filtre)
 * GET /appointments/all
 */
const getAllAppointments = async (req, res) => {
  try {
    console.log('📋 Récupération de TOUS les rendez-vous...');

    const appointments = await Appointment.findAll({
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
      ],
      order: [['appointmentDate', 'DESC']]
    });

    console.log(`✅ ${appointments.length} rendez-vous trouvés au total`);

    res.json({
      success: true,
      data: appointments,
      count: appointments.length
    });

  } catch (error) {
    console.error('❌ Erreur getAllAppointments:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des rendez-vous'
    });
  }
};

/**
 * ✅ Récupérer les rendez-vous avec FILTRES (à venir, passé, tous)
 * GET /appointments?filter=upcoming|past|all
 */
const getAppointments = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, filter = 'all' } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`📋 Récupération des rendez-vous pour ${userRole} ${userId} (filtre: ${filter})...`);

    if (!Appointment || typeof Appointment.findAndCountAll !== 'function') {
      console.error('❌ ERREUR: Modèle Appointment non valide');
      throw new Error('Modèle Appointment non chargé correctement');
    }

    // Construction du WHERE clause
    let whereClause = {};
    
    // Filtre par rôle
    if (userRole === 'patient') {
      whereClause.patientId = userId;
    } else if (userRole === 'doctor') {
      whereClause.doctorId = userId;
    }

    // ✅ FILTRES PAR DATE (CORRIGÉ)
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalisation à minuit

    if (filter === 'upcoming') {
      // À VENIR : Date >= aujourd'hui ET statut non annulé/terminé
      whereClause = {
        ...whereClause,
        appointmentDate: { [Op.gte]: now },
        status: { [Op.notIn]: ['cancelled', 'completed', 'no_show'] }
      };
    } else if (filter === 'past') {
      // HISTORIQUE : Date < aujourd'hui OU statut annulé/terminé
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { appointmentDate: { [Op.lt]: now } },
          { status: { [Op.in]: ['cancelled', 'completed', 'no_show'] } }
        ]
      };
    }
    // else 'all' : PAS DE FILTRE DATE, tous les rendez-vous

    // Filtres supplémentaires
    if (status) whereClause.status = status;
    if (type) whereClause.type = type;

    const offset = (page - 1) * limit;

    // Configuration des associations
    const includeConfig = [];

    if (User && typeof User === 'function') {
      if (userRole === 'doctor') {
        includeConfig.push({
          model: User,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'dateOfBirth', 'gender']
        });
      } else {
        includeConfig.push({
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'specialty', 'consultationPrice']
        });
      }
    }

    if (Payment && typeof Payment === 'function') {
      includeConfig.push({
        model: Payment,
        as: 'payment',
        attributes: ['id', 'amount', 'status', 'paymentMethod'],
        required: false
      });
    }

    // Tri intelligent
    const orderBy = filter === 'past' 
      ? [['appointmentDate', 'DESC']] // Plus récent d'abord pour historique
      : [['appointmentDate', 'ASC']];  // Plus proche d'abord pour à venir et tous

    const { count, rows: appointments } = await Appointment.findAndCountAll({
      where: whereClause,
      include: includeConfig.length > 0 ? includeConfig : [],
      order: orderBy,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    console.log(`✅ ${appointments.length} rendez-vous trouvés (filtre: ${filter})`);

    res.json({
      success: true,
      data: appointments,
      count: appointments.length,
      filter: filter,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(count / limit),
        totalRecords: count
      }
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des rendez-vous:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id,
      role: req.user?.role,
      filter: req.query.filter
    });
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des rendez-vous',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
    });
  }
};

/**
 * ✅ Récupérer un rendez-vous par ID
 * GET /appointments/:id
 */
const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`📋 Récupération du rendez-vous ${id}...`);

    let whereCondition = { id };
    
    // Vérification des permissions
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
          attributes: ['id', 'firstName', 'lastName', 'email', 'specialty', 'consultationPrice', 'biography', 'languages']
        },
        {
          model: Payment,
          as: 'payment',
          attributes: ['id', 'amount', 'status', 'paymentMethod', 'transactionId'],
          required: false
        }
      ]
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }

    console.log(`✅ Rendez-vous trouvé pour le ${formatDate(appointment.appointmentDate)} à ${formatTime(appointment.appointmentDate)}`);

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
};

/**
 * ✅ Annuler un rendez-vous
 * PATCH /appointments/:id/cancel
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

    const appointment = await Appointment.findOne({ 
      where: whereCondition 
    });

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

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Impossible d\'annuler un rendez-vous terminé'
      });
    }

    await appointment.update({
      status: 'cancelled',
      cancellationReason: cancellationReason || `Annulé par le ${userRole === 'doctor' ? 'médecin' : 'patient'}`,
      cancelledAt: new Date()
    });

    // Notification à l'autre partie
    const notificationUserId = userRole === 'patient' 
      ? appointment.doctorId 
      : appointment.patientId;

    try {
      if (notificationService && typeof notificationService.createNotification === 'function') {
        await notificationService.createNotification({
          userId: notificationUserId,
          type: 'appointment_cancelled',
          title: 'Rendez-vous annulé',
          message: `Le rendez-vous du ${new Date(appointment.appointmentDate).toLocaleDateString('fr-FR')} à ${formatTime(appointment.appointmentDate)} a été annulé.`,
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
    console.error('❌ Erreur lors de l\'annulation du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'annulation du rendez-vous',
      error: error.message
    });
  }
};

/**
 * ✅ Confirmer un rendez-vous (médecin)
 * PATCH /appointments/:id/confirm
 */
const confirmAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`✅ Confirmation du rendez-vous ${id} par le médecin ${req.user.id}...`);

    const appointment = await Appointment.findByPk(id, {
      include: [
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName', 'email']
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

    // Vérifier que l'utilisateur est le médecin
    if (appointment.doctorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez confirmer que vos propres rendez-vous'
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

    // Notification au patient
    try {
      if (notificationService && typeof notificationService.createNotification === 'function') {
        await notificationService.createNotification({
          userId: appointment.patientId,
          type: 'appointment_confirmed',
          title: '✅ Rendez-vous confirmé',
          message: `Votre rendez-vous avec Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} le ${new Date(appointment.appointmentDate).toLocaleDateString('fr-FR')} à ${new Date(appointment.appointmentDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} a été confirmé.`,
          data: { 
            appointmentId: appointment.id,
            doctorName: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
            date: appointment.appointmentDate
          }
        });
        console.log(`📧 Notification envoyée au patient ${appointment.patientId}`);
      }
    } catch (notifError) {
      console.warn('⚠️ Erreur envoi notification:', notifError.message);
    }

    // Audit log
    try {
      await AuditLog.create({
        action: 'APPOINTMENT_CONFIRMED',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: {
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          date: appointment.appointmentDate
        }
      });
    } catch (auditError) {
      console.warn('⚠️ Erreur audit log:', auditError.message);
    }

    console.log(`✅ Rendez-vous ${id} confirmé avec succès`);

    res.json({
      success: true,
      message: 'Rendez-vous confirmé avec succès',
      data: {
        appointment,
        notification: 'Le patient a été notifié'
      }
    });

  } catch (error) {
    console.error('❌ Erreur confirmation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la confirmation',
      error: error.message
    });
  }
};

/**
 * ✅ Marquer un rendez-vous comme terminé (médecin)
 * PATCH /appointments/:id/complete
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
        message: 'Seul le médecin peut marquer ce rendez-vous comme terminé'
      });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Ce rendez-vous est déjà terminé'
      });
    }

    await appointment.update({ 
      status: 'completed',
      notes: notes || appointment.notes,
      completedAt: new Date()
    });

    // Notification au patient
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

    console.log(`✅ Rendez-vous ${id} marqué comme terminé`);

    res.json({
      success: true,
      message: 'Rendez-vous marqué comme terminé',
      data: appointment
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la finalisation du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la finalisation du rendez-vous',
      error: error.message
    });
  }
};

/**
 * ✅ Noter un rendez-vous (patient)
 * POST /appointments/:id/rate
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
        message: 'Rendez-vous non trouvé ou non éligible à la notation'
      });
    }

    if (appointment.rating) {
      return res.status(400).json({
        success: false,
        message: 'Ce rendez-vous a déjà été noté'
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
      feedback: feedback || null,
      ratedAt: new Date()
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
};

// ============================================
// EXPORT DE TOUTES LES FONCTIONS
// ============================================
module.exports = {
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
};
