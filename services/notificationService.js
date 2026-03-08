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

      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

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

      let emailResult = null;
      let smsResult = null;

      if (channel === 'email' || channel === 'both') {
        if (user.email) {
          emailResult = await emailService.sendTemplate(type, data, user.email);
        }
      }

      if (channel === 'sms' || channel === 'both') {
        if (user.phoneNumber) {
          smsResult = await smsService.sendTemplate(type, data, user.phoneNumber);
        }
      }

      await notification.update({
        isDelivered: true,
        sentAt: new Date()
      });

      await this.logNotification({
        notificationId: notification.id,
        appointmentId,
        userId,
        channel,
        recipient: channel === 'email' ? user.email : user.phoneNumber,
        type,
        status: 'sent',
        provider: channel === 'email' ? 'SMTP' : 'smsmode',
        providerId: emailResult?.messageId || smsResult?.providerId
      });

      console.log(`✅ Notification envoyée à ${user.email || user.phoneNumber}`);
      return notification;

    } catch (error) {
      console.error('❌ Erreur envoi notification:', error);

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
   * ✅ Envoyer un message de bienvenue : email en priorité, SMS en fallback
   * Garantit qu'au moins une notification est envoyée si possible.
   */
  async sendWelcomeNotification(user) {
    console.log(`\n📬 [Welcome] Envoi notification de bienvenue pour ${user.firstName} ${user.lastName}`);

    const result = { emailSent: false, smsSent: false, atLeastOne: false };

    // ── 1. Tentative EMAIL ────────────────────────────────────────────────────
    if (user.email) {
      try {
        const emailResult = await emailService.sendTemplate('welcome', user, user.email);

        if (emailResult.success && !emailResult.simulated) {
          result.emailSent = true;
          console.log(`✅ [Welcome] Email envoyé à ${user.email}`);

          // Email réel envoyé → on log et on s'arrête là
          await this._logWelcome(user, 'email', 'sent', emailResult.messageId);
        } else {
          // Simulé = SMTP indisponible → fallback SMS
          console.warn(`⚠️ [Welcome] Email simulé pour ${user.email}, tentative SMS...`);
        }
      } catch (err) {
        console.error(`❌ [Welcome] Erreur email :`, err.message);
      }
    }

    // ── 2. Tentative SMS (fallback ou si pas d'email) ─────────────────────────
    const shouldTrySMS = user.phoneNumber && !result.emailSent;

    if (shouldTrySMS) {
      try {
        const smsResult = await smsService.sendTemplate('welcome', user, user.phoneNumber);

        if (smsResult.success && !smsResult.simulated) {
          result.smsSent = true;
          console.log(`✅ [Welcome] SMS envoyé à ${user.phoneNumber}`);

          await this._logWelcome(user, 'sms', 'sent', smsResult.providerId);
        } else {
          console.warn(`⚠️ [Welcome] SMS simulé pour ${user.phoneNumber}`);
        }
      } catch (err) {
        console.error(`❌ [Welcome] Erreur SMS :`, err.message);
      }
    }

    // ── 3. Bilan ──────────────────────────────────────────────────────────────
    result.atLeastOne = result.emailSent || result.smsSent;

    if (!result.atLeastOne) {
      console.warn(`⚠️ [Welcome] Aucune notification envoyée pour ${user.firstName} ${user.lastName}`);
      if (!user.email && !user.phoneNumber) {
        console.warn(`⚠️ [Welcome] Ni email ni téléphone disponible`);
      }
    }

    return result;
  }

  /**
   * Log interne pour la notification de bienvenue
   */
  async _logWelcome(user, channel, status, providerId = null) {
    try {
      await this.logNotification({
        userId: user.id,
        channel,
        type: 'welcome',
        recipient: channel === 'email' ? user.email : user.phoneNumber,
        status,
        provider: channel === 'email' ? 'SMTP' : 'smsmode',
        providerId
      });
    } catch (err) {
      console.warn('⚠️ [Welcome] Erreur log:', err.message);
    }
  }

  /**
   * @deprecated Utiliser sendWelcomeNotification() à la place
   * Conservé pour la compatibilité avec l'authController existant
   */
  async sendWelcomeEmail(user) {
    return this.sendWelcomeNotification(user);
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

      await this.sendNotification({
        userId: patient.id,
        type: 'appointmentConfirmation',
        channel: 'both',
        title: '✅ Rendez-vous confirmé',
        message: `Votre rendez-vous avec Dr. ${doctor.lastName} le ${new Date(fullAppointment.appointmentDate).toLocaleDateString('fr-FR')} a été confirmé.`,
        data: { appointment: fullAppointment },
        priority: 'high',
        appointmentId: fullAppointment.id
      });

      await this.sendNotification({
        userId: doctor.id,
        type: 'appointmentConfirmation',
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
      const type = hoursBefore === 24 ? 'appointmentReminder24h' : 'appointmentReminder1h';
      const title = hoursBefore === 24 ? '⏰ Rappel: Rendez-vous demain' : '⚠️ Rappel urgent: Rendez-vous dans 1 heure';

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

      await this.sendNotification({
        userId: patient.id,
        type: 'appointmentCancellation',
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

      await this.sendNotification({
        userId: doctor.id,
        type: 'appointmentCancellation',
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

  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      where: { id: notificationId, userId }
    });

    if (!notification) throw new Error('Notification non trouvée');

    await notification.update({ isRead: true });
    return notification;
  }

  async markAllAsRead(userId) {
    await Notification.update(
      { isRead: true },
      { where: { userId, isRead: false } }
    );
    return true;
  }

  async getUnreadCount(userId) {
    return await Notification.count({
      where: { userId, isRead: false }
    });
  }

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

  async logNotification(data) {
    try {
      return await NotificationLog.create({
        notificationId: data.notificationId || null,
        appointmentId:  data.appointmentId  || null,
        userId:         data.userId,
        channel:        data.channel,
        recipient:      data.recipient      || null,
        type:           data.type,
        status:         data.status,
        provider:       data.provider       || null,
        providerId:     data.providerId     || null,
        error:          data.error          || null,
        sentAt:         data.status === 'sent' ? new Date() : null
      });
    } catch (error) {
      console.error('❌ Erreur création log:', error);
    }
  }

  async getStats(userId = null) {
    const whereClause = userId ? { userId } : {};

    const total     = await Notification.count({ where: whereClause });
    const unread    = await Notification.count({ where: { ...whereClause, isRead: false } });
    const delivered = await Notification.count({ where: { ...whereClause, isDelivered: true } });

    return { total, unread, delivered };
  }
}

module.exports = new NotificationService();
