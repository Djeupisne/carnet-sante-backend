const { Notification, NotificationLog, User, Appointment } = require('../models');
const emailService = require('./emailService');
const smsService = require('./smsService');
const { Op } = require('sequelize');

class NotificationService {
  constructor() {
    this.scheduledJobs = new Map();
  }

  /**
   * Créer et envoyer une notification
   */
  async sendNotification({
    userId,
    type,
    channel = 'in_app',
    title,
    message,
    data = {},
    priority = 'medium',
    appointmentId = null
  }) {
    try {
      console.log(`📧 Création de notification pour utilisateur ${userId}`, { type, channel });

      // Récupérer l'utilisateur
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

      // 1. Créer la notification en base
      const notification = await Notification.create({
        userId,
        type,
        channel,
        title,
        message,
        data,
        priority,
        isRead: false,
        isDelivered: false
      });

      // 2. Envoyer selon le canal choisi
      let emailResult = null;
      let smsResult = null;

      // Envoi par email
      if (channel === 'email' || channel === 'both') {
        if (user.email) {
          emailResult = await emailService.sendTemplate(type, data, user.email);
        }
      }

      // Envoi par SMS
      if (channel === 'sms' || channel === 'both') {
        if (user.phoneNumber) {
          smsResult = await smsService.sendTemplate(type, data, user.phoneNumber);
        }
      }

      // 3. Mettre à jour le statut
      await notification.update({
        isDelivered: true,
        sentAt: new Date()
      });

      // 4. Logguer l'envoi
      await this.logNotification({
        notificationId: notification.id,
        appointmentId,
        userId,
        channel,
        recipient: channel === 'email' ? user.email : user.phoneNumber,
        type,
        status: 'sent',
        provider: channel === 'email' ? 'SMTP' : 'Twilio',
        providerId: emailResult?.messageId || smsResult?.messageId
      });

      console.log(`✅ Notification envoyée à ${user.email || user.phoneNumber}`);
      return notification;

    } catch (error) {
      console.error('❌ Erreur envoi notification:', error);

      // Logguer l'échec
      await this.logNotification({
        userId,
        appointmentId,
        channel,
        type,
        status: 'failed',
        error: error.message
      }).catch(e => console.error('Erreur log:', e));

      throw error;
    }
  }

  /**
   * Envoyer une confirmation de rendez-vous
   */
  async sendAppointmentConfirmation(appointment) {
    try {
      const fullAppointment = await Appointment.findByPk(appointment.id, {
        include: [
          { model: User, as: 'patient' },
          { model: User, as: 'doctor' }
        ]
      });

      if (!fullAppointment) return;

      const { patient, doctor } = fullAppointment;

      // Notification au patient
      await this.sendNotification({
        userId: patient.id,
        type: 'appointment_confirmation',
        channel: 'both',
        title: '✅ Rendez-vous confirmé',
        message: `Votre rendez-vous avec Dr. ${doctor.lastName} le ${new Date(fullAppointment.appointmentDate).toLocaleDateString('fr-FR')} a été confirmé.`,
        data: { appointment: fullAppointment },
        priority: 'high',
        appointmentId: fullAppointment.id
      });

      // Notification au médecin
      await this.sendNotification({
        userId: doctor.id,
        type: 'appointment_confirmation',
        channel: 'email',
        title: '✅ Nouveau rendez-vous confirmé',
        message: `Rendez-vous confirmé avec ${patient.firstName} ${patient.lastName}`,
        data: { appointment: fullAppointment },
        priority: 'medium',
        appointmentId: fullAppointment.id
      });

    } catch (error) {
      console.error('❌ Erreur envoi confirmation:', error);
    }
  }

  /**
   * Envoyer un rappel de rendez-vous
   */
  async sendAppointmentReminder(appointment, hoursBefore) {
    try {
      const fullAppointment = await Appointment.findByPk(appointment.id, {
        include: [
          { model: User, as: 'patient' },
          { model: User, as: 'doctor' }
        ]
      });

      if (!fullAppointment) return;

      const { patient, doctor } = fullAppointment;
      const type = hoursBefore === 24 ? 'appointment_reminder_24h' : 'appointment_reminder_1h';
      const title = hoursBefore === 24 ? '⏰ Rappel: Rendez-vous demain' : '⚠️ Rappel urgent: Rendez-vous dans 1 heure';

      // Notification au patient
      await this.sendNotification({
        userId: patient.id,
        type,
        channel: 'both',
        title,
        message: hoursBefore === 24 
          ? `Rappel: Vous avez rendez-vous avec Dr. ${doctor.lastName} demain.`
          : `Rappel urgent: Votre rendez-vous avec Dr. ${doctor.lastName} est dans 1 heure.`,
        data: { appointment: fullAppointment, hoursBefore },
        priority: hoursBefore === 1 ? 'urgent' : 'high',
        appointmentId: fullAppointment.id
      });

      // Notification au médecin (email uniquement)
      await this.sendNotification({
        userId: doctor.id,
        type,
        channel: 'email',
        title,
        message: hoursBefore === 24
          ? `Rappel: Rendez-vous avec ${patient.firstName} ${patient.lastName} demain.`
          : `Rappel: Rendez-vous avec ${patient.firstName} ${patient.lastName} dans 1 heure.`,
        data: { appointment: fullAppointment, hoursBefore },
        priority: 'medium',
        appointmentId: fullAppointment.id
      });

    } catch (error) {
      console.error('❌ Erreur envoi rappel:', error);
    }
  }

  /**
   * Envoyer une annulation de rendez-vous
   */
  async sendAppointmentCancellation(appointment, cancelledBy) {
    try {
      const fullAppointment = await Appointment.findByPk(appointment.id, {
        include: [
          { model: User, as: 'patient' },
          { model: User, as: 'doctor' }
        ]
      });

      if (!fullAppointment) return;

      const { patient, doctor } = fullAppointment;

      // Notification au patient
      await this.sendNotification({
        userId: patient.id,
        type: 'appointment_cancellation',
        channel: 'both',
        title: '❌ Rendez-vous annulé',
        message: `Votre rendez-vous avec Dr. ${doctor.lastName} a été annulé.`,
        data: { 
          appointment: fullAppointment,
          cancelledBy,
          reason: appointment.cancellationReason 
        },
        priority: 'high',
        appointmentId: fullAppointment.id
      });

      // Notification au médecin
      await this.sendNotification({
        userId: doctor.id,
        type: 'appointment_cancellation',
        channel: 'email',
        title: '❌ Rendez-vous annulé',
        message: `Rendez-vous avec ${patient.firstName} ${patient.lastName} annulé.`,
        data: { 
          appointment: fullAppointment,
          cancelledBy,
          reason: appointment.cancellationReason 
        },
        priority: 'medium',
        appointmentId: fullAppointment.id
      });

    } catch (error) {
      console.error('❌ Erreur envoi annulation:', error);
    }
  }

  /**
   * Envoyer un email de bienvenue
   */
  async sendWelcomeEmail(user) {
    try {
      await this.sendNotification({
        userId: user.id,
        type: 'welcome',
        channel: 'email',
        title: `Bienvenue sur Carnet Santé, ${user.firstName}!`,
        message: 'Votre compte a été créé avec succès.',
        data: { user },
        priority: 'medium'
      });
    } catch (error) {
      console.error('❌ Erreur envoi welcome:', error);
    }
  }

  /**
   * Récupérer les notifications d'un utilisateur
   */
  async getUserNotifications(userId, options = {}) {
    const { page = 1, limit = 20, unreadOnly = false } = options;
    const offset = (page - 1) * limit;

    const whereClause = { userId };
    if (unreadOnly) whereClause.isRead = false;

    const { count, rows } = await Notification.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    return {
      notifications: rows,
      pagination: {
        current: page,
        total: Math.ceil(count / limit),
        totalRecords: count
      },
      unreadCount: await this.getUnreadCount(userId)
    };
  }

  /**
   * Marquer une notification comme lue
   */
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      where: { id: notificationId, userId }
    });

    if (!notification) {
      throw new Error('Notification non trouvée');
    }

    await notification.update({ isRead: true });
    return notification;
  }

  /**
   * Marquer toutes les notifications comme lues
   */
  async markAllAsRead(userId) {
    await Notification.update(
      { isRead: true },
      { where: { userId, isRead: false } }
    );
    return true;
  }

  /**
   * Compter les notifications non lues
   */
  async getUnreadCount(userId) {
    return await Notification.count({
      where: { userId, isRead: false }
    });
  }

  /**
   * Supprimer les anciennes notifications
   */
  async cleanupOldNotifications(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await Notification.destroy({
      where: {
        createdAt: { [Op.lt]: cutoffDate },
        isRead: true
      }
    });
  }

  /**
   * Logger une notification
   */
  async logNotification(data) {
    try {
      return await NotificationLog.create({
        notificationId: data.notificationId,
        appointmentId: data.appointmentId,
        userId: data.userId,
        channel: data.channel,
        recipient: data.recipient,
        type: data.type,
        status: data.status,
        provider: data.provider,
        providerId: data.providerId,
        error: data.error,
        sentAt: data.status === 'sent' ? new Date() : null
      });
    } catch (error) {
      console.error('❌ Erreur création log:', error);
    }
  }

  /**
   * Obtenir les statistiques des notifications
   */
  async getStats(userId = null) {
    const whereClause = userId ? { userId } : {};

    const total = await Notification.count(whereClause);
    const unread = await Notification.count({ ...whereClause, isRead: false });
    const delivered = await Notification.count({ ...whereClause, isDelivered: true });

    return {
      total,
      unread,
      delivered,
      byType: await this.getCountByType(whereClause),
      byChannel: await this.getCountByChannel(whereClause)
    };
  }

  async getCountByType(whereClause) {
    const types = await Notification.findAll({
      where: whereClause,
      attributes: ['type', [sequelize.fn('COUNT', sequelize.col('type')), 'count']],
      group: ['type']
    });
    return types.reduce((acc, t) => ({ ...acc, [t.type]: parseInt(t.dataValues.count) }), {});
  }

  async getCountByChannel(whereClause) {
    const channels = await Notification.findAll({
      where: whereClause,
      attributes: ['channel', [sequelize.fn('COUNT', sequelize.col('channel')), 'count']],
      group: ['channel']
    });
    return channels.reduce((acc, c) => ({ ...acc, [c.channel]: parseInt(c.dataValues.count) }), {});
  }
}

module.exports = new NotificationService();
