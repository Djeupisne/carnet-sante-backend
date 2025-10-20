const { Notification } = require('../models');
const emailService = require('./emailService');
const smsService = require('./smsService');

class NotificationService {
  async createNotification(notificationData) {
    try {
      const notification = await Notification.create(notificationData);
      
      // Envoyer les notifications en temps réel si possible
      this.sendRealTimeNotification(notification);
      
      return notification;
    } catch (error) {
      console.error('Erreur lors de la création de la notification:', error);
      throw error;
    }
  }

  async sendRealTimeNotification(notification) {
    // Implémentation pour les WebSockets ou push notifications
    // À intégrer avec Socket.io ou un service de push notifications
    try {
      // Exemple avec Socket.io
      if (global.io) {
        global.io.to(`user_${notification.userId}`).emit('notification', {
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data
        });
      }

      // Envoyer par email pour les notifications importantes
      if (notification.priority === 'high' || notification.priority === 'urgent') {
        await this.sendEmailNotification(notification);
      }

      // Envoyer par SMS pour les notifications urgentes
      if (notification.priority === 'urgent') {
        await this.sendSMSNotification(notification);
      }

    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification en temps réel:', error);
    }
  }

  async sendEmailNotification(notification) {
    try {
      const user = await User.findByPk(notification.userId);
      
      if (user && user.email) {
        await emailService.sendTemplateEmail({
          to: user.email,
          subject: notification.title,
          template: 'notification',
          data: {
            title: notification.title,
            message: notification.message,
            user: {
              firstName: user.firstName,
              lastName: user.lastName
            }
          }
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email de notification:', error);
    }
  }

  async sendSMSNotification(notification) {
    try {
      const user = await User.findByPk(notification.userId);
      
      if (user && user.phoneNumber) {
        await smsService.sendSMS({
          to: user.phoneNumber,
          message: `${notification.title}: ${notification.message}`
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du SMS de notification:', error);
    }
  }

  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          userId
        }
      });

      if (!notification) {
        throw new Error('Notification non trouvée');
      }

      await notification.update({ isRead: true });
      return notification;
    } catch (error) {
      console.error('Erreur lors du marquage de la notification comme lue:', error);
      throw error;
    }
  }

  async getUserNotifications(userId, options = {}) {
    try {
      const { page = 1, limit = 20, unreadOnly = false } = options;
      const offset = (page - 1) * limit;

      const whereClause = { userId };
      if (unreadOnly) {
        whereClause.isRead = false;
      }

      const { count, rows: notifications } = await Notification.findAndCountAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return {
        notifications,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(count / limit),
          totalRecords: count
        }
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des notifications:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();