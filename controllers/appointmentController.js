const { Appointment, User, Payment, MedicalFile, AuditLog } = require('../models');
const { validationService } = require('../services/validationService');
const { notificationService } = require('../services/notificationService');
const { Op } = require('sequelize');

exports.createAppointment = async (req, res) => {
  try {
    const {
      doctorId,
      appointmentDate,
      duration,
      type,
      reason,
      symptoms
    } = req.body;

    const patientId = req.user.id;

    // Validation
    const validation = validationService.validateAppointment(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Données de rendez-vous invalides',
        errors: validation.errors
      });
    }

    // Vérifier que le médecin existe
    const doctor = await User.findByPk(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({
        success: false,
        message: 'Médecin non trouvé'
      });
    }

    // Vérifier les disponibilités
    const existingAppointment = await Appointment.findOne({
      where: {
        doctorId,
        appointmentDate: {
          [Op.between]: [
            new Date(appointmentDate),
            new Date(new Date(appointmentDate).getTime() + duration * 60000)
          ]
        },
        status: {
          [Op.in]: ['pending', 'confirmed']
        }
      }
    });

    if (existingAppointment) {
      return res.status(409).json({
        success: false,
        message: 'Le médecin n\'est pas disponible à cette heure'
      });
    }

    // Créer le rendez-vous
    const appointment = await Appointment.create({
      patientId,
      doctorId,
      appointmentDate,
      duration: duration || 30,
      type: type || 'in_person',
      reason,
      symptoms: symptoms || []
    });

    // Créer une notification pour le médecin
    await notificationService.createNotification({
      userId: doctorId,
      type: 'new_appointment',
      title: 'Nouveau rendez-vous',
      message: `Nouveau rendez-vous avec ${req.user.firstName} ${req.user.lastName}`,
      data: { appointmentId: appointment.id }
    });

    // Log d'audit
    await AuditLog.create({
      action: 'APPOINTMENT_CREATED',
      userId: patientId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: {
        appointmentId: appointment.id,
        doctorId,
        appointmentDate
      }
    });

    res.status(201).json({
      success: true,
      message: 'Rendez-vous créé avec succès',
      data: { appointment }
    });

  } catch (error) {
    console.error('Erreur lors de la création du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Construire la requête selon le rôle
    const whereClause = {};
    if (userRole === 'patient') {
      whereClause.patientId = userId;
    } else if (userRole === 'doctor') {
      whereClause.doctorId = userId;
    }

    if (status) {
      whereClause.status = status;
    }
    if (type) {
      whereClause.type = type;
    }

    const offset = (page - 1) * limit;

    const { count, rows: appointments } = await Appointment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: userRole === 'patient' ? 'doctor' : 'patient',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: Payment,
          as: 'payment',
          attributes: ['id', 'amount', 'status', 'paymentMethod']
        }
      ],
      order: [['appointmentDate', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(count / limit),
          totalRecords: count
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancellationReason } = req.body;

    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: User, as: 'patient' },
        { model: User, as: 'doctor' }
      ]
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }

    // Vérifier les permissions
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

    const updates = { status };
    if (status === 'cancelled' && cancellationReason) {
      updates.cancellationReason = cancellationReason;
    }

    await appointment.update(updates);

    // Notifier l'autre partie
    const notificationUserId = req.user.role === 'patient' 
      ? appointment.doctorId 
      : appointment.patientId;

    await notificationService.createNotification({
      userId: notificationUserId,
      type: 'appointment_update',
      title: 'Statut du rendez-vous modifié',
      message: `Le rendez-vous du ${new Date(appointment.appointmentDate).toLocaleDateString()} est maintenant ${status}`,
      data: { appointmentId: appointment.id, status }
    });

    // Log d'audit
    await AuditLog.create({
      action: 'APPOINTMENT_STATUS_UPDATED',
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: {
        appointmentId: id,
        oldStatus: appointment.status,
        newStatus: status
      }
    });

    res.json({
      success: true,
      message: 'Statut du rendez-vous mis à jour avec succès',
      data: { appointment }
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

exports.getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'patient', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Payment, as: 'payment', attributes: ['id', 'amount', 'status', 'paymentMethod'] }
      ]
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }

    // Vérification d'accès
    if (
      req.user.role === 'patient' && appointment.patientId !== req.user.id ||
      req.user.role === 'doctor' && appointment.doctorId !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce rendez-vous'
      });
    }

    res.json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

exports.completeAppointment = async (req, res) => {
  try {
    const { id } = req.params;

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

    await appointment.update({ status: 'completed' });

    await notificationService.createNotification({
      userId: appointment.patientId,
      type: 'appointment_completed',
      title: 'Rendez-vous terminé',
      message: `Votre rendez-vous du ${new Date(appointment.appointmentDate).toLocaleDateString()} est terminé.`,
      data: { appointmentId: appointment.id }
    });

    await AuditLog.create({
      action: 'APPOINTMENT_COMPLETED',
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { appointmentId: id }
    });

    res.json({
      success: true,
      message: 'Rendez-vous marqué comme terminé',
      data: { appointment }
    });
  } catch (error) {
    console.error('Erreur lors de la finalisation du rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};