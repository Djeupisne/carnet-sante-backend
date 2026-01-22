// CORRECTION : Import depuis models/index.js et Op inclus
const { Appointment, User, Payment, AuditLog, Op } = require('../models');
const { validationService } = require('../services/validationService');
const { notificationService } = require('../services/notificationService');

// Créer un nouveau rendez-vous
const createAppointment = async (req, res) => {
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

    console.log(`📝 Création d'un nouveau rendez-vous pour le patient ${patientId}...`);

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

    // Vérifier les disponibilités
    const existingAppointment = await Appointment.findOne({
      where: {
        doctorId,
        appointmentDate: {
          [Op.between]: [
            new Date(appointmentDate),
            new Date(new Date(appointmentDate).getTime() + (duration || 30) * 60000)
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
      appointmentDate: new Date(appointmentDate),
      duration: duration || 30,
      type: type || 'in_person',
      reason,
      symptoms: symptoms || [],
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

    // Créer une notification pour le médecin
    try {
      await notificationService.createNotification({
        userId: doctorId,
        type: 'new_appointment',
        title: 'Nouveau rendez-vous',
        message: `Nouveau rendez-vous avec ${req.user.firstName} ${req.user.lastName}`,
        data: { appointmentId: appointment.id }
      });
    } catch (notifError) {
      console.warn('⚠️ Erreur lors de la création de la notification:', notifError.message);
    }

    // Log d'audit
    try {
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
    } catch (auditError) {
      console.warn('⚠️ Erreur lors de la création du log d\'audit:', auditError.message);
    }

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
};

// Récupérer tous les rendez-vous - VERSION CORRIGÉE AVEC DÉBOGAGE
const getAppointments = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`📋 Récupération des rendez-vous pour l'utilisateur ${userId} (${userRole})...`);

    // DÉBOGAGE: Vérifier les modèles importés
    console.log('🔍 Vérification des modèles importés:');
    console.log('- Appointment:', Appointment ? 'OK' : 'NULL');
    console.log('- User:', User ? 'OK' : 'NULL');
    console.log('- Payment:', Payment ? 'OK' : 'NULL');
    console.log('- Op:', Op ? 'OK' : 'NULL');

    if (!Appointment || typeof Appointment.findAndCountAll !== 'function') {
      console.error('❌ ERREUR: Modèle Appointment non valide');
      throw new Error('Modèle Appointment non chargé correctement');
    }

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

    // TEST SIMPLE SANS INCLUDES D'ABORD
    console.log('🔍 Test sans includes...');
    try {
      const testResult = await Appointment.findAndCountAll({
        where: whereClause,
        limit: 1,
        offset: 0
      });
      console.log(`✅ Test réussi: ${testResult.count} rendez-vous trouvés (sans includes)`);
    } catch (testError) {
      console.error('❌ Test échoué:', testError.message);
      throw testError;
    }

    // PRÉPARER LES INCLUDES AVEC VÉRIFICATION
    const includeConfig = [];

    // Vérifier et ajouter l'inclusion du patient
    if (User && typeof User === 'function') {
      try {
        // Vérifier si l'association existe
        const associations = Appointment.associations;
        console.log('🔍 Associations de Appointment:', Object.keys(associations || {}));
        
        includeConfig.push({
          model: User,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'dateOfBirth', 'gender']
        });
        
        includeConfig.push({
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'specialty', 'licenseNumber', 'biography', 'consultationPrice', 'languages']
        });
      } catch (assocError) {
        console.warn('⚠️ Erreur avec les associations User:', assocError.message);
      }
    } else {
      console.warn('⚠️ Modèle User non disponible pour les includes');
    }

    // Vérifier et ajouter l'inclusion du paiement
    if (Payment && typeof Payment === 'function') {
      includeConfig.push({
        model: Payment,
        as: 'payment',
        attributes: ['id', 'amount', 'status', 'paymentMethod'],
        required: false
      });
    }

    console.log('🔍 Configuration includes:', includeConfig.length, 'éléments');

    // EXÉCUTER LA REQUÊTE COMPLÈTE
    const { count, rows: appointments } = await Appointment.findAndCountAll({
      where: whereClause,
      include: includeConfig.length > 0 ? includeConfig : [],
      order: [['appointmentDate', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    console.log(`✅ ${appointments.length} rendez-vous trouvés avec succès`);

    res.json({
      success: true,
      data: appointments,
      count: appointments.length,
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
      role: req.user?.role
    });
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des rendez-vous',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
    });
  }
};

// Récupérer un rendez-vous par ID - VERSION SIMPLIFIÉE
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

    // Version simplifiée sans includes pour commencer
    const appointment = await Appointment.findOne({
      where: whereCondition
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
};

// Mettre à jour le statut d'un rendez-vous
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

    const updates = { status };
    if (status === 'cancelled' && cancellationReason) {
      updates.cancellationReason = cancellationReason;
    }

    await appointment.update(updates);

    const notificationUserId = req.user.role === 'patient' 
      ? appointment.doctorId 
      : appointment.patientId;

    try {
      await notificationService.createNotification({
        userId: notificationUserId,
        type: 'appointment_update',
        title: 'Statut du rendez-vous modifié',
        message: `Le rendez-vous du ${new Date(appointment.appointmentDate).toLocaleDateString()} est maintenant ${status}`,
        data: { appointmentId: appointment.id, status }
      });
    } catch (notifError) {
      console.warn('⚠️ Erreur lors de la création de la notification:', notifError.message);
    }

    try {
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
    } catch (auditError) {
      console.warn('⚠️ Erreur lors de la création du log d\'audit:', auditError.message);
    }

    console.log(`✅ Statut du rendez-vous ${id} mis à jour: ${status}`);

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

// Annuler un rendez-vous
const cancelAppointment = async (req, res) => {
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
};

// Confirmer un rendez-vous
const confirmAppointment = async (req, res) => {
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
};

// Marquer un rendez-vous comme terminé
const completeAppointment = async (req, res) => {
  try {
    const { id } = req.params;

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

    await appointment.update({ status: 'completed' });

    try {
      await notificationService.createNotification({
        userId: appointment.patientId,
        type: 'appointment_completed',
        title: 'Rendez-vous terminé',
        message: `Votre rendez-vous du ${new Date(appointment.appointmentDate).toLocaleDateString()} est terminé.`,
        data: { appointmentId: appointment.id }
      });
    } catch (notifError) {
      console.warn('⚠️ Erreur lors de la création de la notification:', notifError.message);
    }

    try {
      await AuditLog.create({
        action: 'APPOINTMENT_COMPLETED',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: { appointmentId: id }
      });
    } catch (auditError) {
      console.warn('⚠️ Erreur lors de la création du log d\'audit:', auditError.message);
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

// Noter un rendez-vous
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
};

// Export de toutes les fonctions
module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  cancelAppointment,
  confirmAppointment,
  completeAppointment,
  rateAppointment
};
