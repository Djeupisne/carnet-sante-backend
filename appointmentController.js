const { Appointment, User, Payment, AuditLog, Op, sequelize } = require('../models');
const { validationService } = require('../services/validationService');
const { notificationService } = require('../services/notificationService');
const { v4: uuidv4 } = require('uuid');
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
const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};
const formatTime = (date) => {
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};
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
    console.error('❌ Erreur lors de la récupération des créneaux disponibles:', error);
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
    try {
      await notificationService.createNotification({
        userId: doctorId,
        type: 'new_appointment',
        title: 'Nouveau rendez-vous',
        message: `Nouveau rendez-vous avec ${req.user.firstName} ${req.user.lastName} le ${new Date(appointmentDate).toLocaleDateString('fr-FR')} à ${timeStr}`,
        data: { appointmentId: appointment.id }
      });
    } catch (notifError) {
      console.warn('⚠️ Erreur lors de la création de la notification:', notifError.message);
    }
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
    let whereClause = {};
    if (userRole === 'patient') {
      whereClause.patientId = userId;
    } else if (userRole === 'doctor') {
      whereClause.doctorId = userId;
    }
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
    const orderBy = filter === 'past' 
      ? [['appointmentDate', 'DESC']]
      : [['appointmentDate', 'ASC']];
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
    const notificationUserId = userRole === 'patient' 
      ? appointment.doctorId 
      : appointment.patientId;
    try {
      await notificationService.createNotification({
        userId: notificationUserId,
        type: 'appointment_cancelled',
        title: 'Rendez-vous annulé',
        message: `Le rendez-vous du ${new Date(appointment.appointmentDate).toLocaleDateString('fr-FR')} à ${formatTime(appointment.appointmentDate)} a été annulé.`,
        data: { appointmentId: appointment.id }
      });
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
    if (appointment.doctorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez confirmer que vos propres rendez-vous'
      });
    }
    if (appointment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Ce rendez-vous ne peut plus être confirmé'
      });
    }
    await appointment.update({
      status: 'confirmed',
      confirmedAt: new Date()
    });
    try {
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
    } catch (notifError) {
      console.warn('⚠️ Erreur envoi notification:', notifError.message);
    }
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
    try {
      await notificationService.createNotification({
        userId: appointment.patientId,
        type: 'appointment_completed',
        title: 'Rendez-vous terminé',
        message: `Votre rendez-vous du ${new Date(appointment.appointmentDate).toLocaleDateString('fr-FR')} est terminé.`,
        data: { appointmentId: appointment.id }
      });
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
const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancellationReason } = req.body;
    console.log(`🔄 Mise à jour du statut du rendez-vous ${id}...`);
    const appointment = await Appointment.findByPk(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }
    if (req.user.role === 'patient' && appointment.patientId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à modifier ce rendez-vous'
      });
    }
    if (req.user.role === 'doctor' && appointment.doctorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à modifier ce rendez-vous'
      });
    }
    const oldStatus = appointment.status;
    const updates = { status };
    if (status === 'cancelled' && cancellationReason) {
      updates.cancellationReason = cancellationReason;
      updates.cancelledAt = new Date();
    }
    await appointment.update(updates);
    console.log(`✅ Statut du rendez-vous ${id} mis à jour: ${oldStatus} -> ${status}`);
    res.json({
      success: true,
      message: 'Statut du rendez-vous mis à jour avec succès',
      data: appointment
    });
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour du rendez-vous',
      error: error.message
    });
  }
};
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
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    let whereClause = {};
    if (userRole === 'doctor') {
      whereClause.doctorId = userId;
    } else {
      whereClause.patientId = userId;
    }
    const totalAppointments = await Appointment.count({ where: whereClause });
    const todayAppointments = await Appointment.count({
      where: {
        ...whereClause,
        appointmentDate: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        }
      }
    });
    const upcomingAppointments = await Appointment.count({
      where: {
        ...whereClause,
        appointmentDate: { [Op.gte]: today },
        status: { [Op.notIn]: ['cancelled', 'completed'] }
      }
    });
    const totalPatients = userRole === 'doctor' 
      ? await Appointment.count({
          where: { doctorId: userId },
          distinct: true,
          col: 'patientId'
        })
      : 1;
    res.json({
      success: true,
      data: {
        stats: {
          totalAppointments,
          todayAppointments,
          upcomingAppointments,
          totalPatients
        }
      }
    });
  } catch (error) {
    console.error('❌ Erreur getDashboardStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};
module.exports = {
  getAvailableSlots,
  getBookedSlots,
  createAppointment,
  getAppointments,
  getAllAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  cancelAppointment,
  confirmAppointment,
  completeAppointment,
  rateAppointment,
  getDashboardStats
};
