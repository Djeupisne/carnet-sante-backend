const { Notification, User } = require('../models'); // ✅ AJOUT DE User ICI !
const emailService = require('./emailService');
const smsService = require('./smsService');

class NotificationService {
  /**
   * ✅ Créer une notification
   */
  async createNotification(notificationData) {
    try {
      console.log(`📧 Création de notification:`, notificationData);
      
      const notification = await Notification.create({
        ...notificationData,
        isRead: false,
        sentAt: new Date()
      });
      
      // ✅ NE PAS BLOQUER - Lancer en arrière-plan sans await
      this.sendRealTimeNotification(notification).catch(err => {
        console.warn('⚠️ Erreur envoi temps réel (non bloquant):', err.message);
      });
      
      console.log(`✅ Notification créée: ${notification.id}`);
      return notification;
    } catch (error) {
      console.error('❌ Erreur création notification:', error);
      throw error;
    }
  }

  /**
   * ✅ Envoyer notification en temps réel
   */
  async sendRealTimeNotification(notification) {
    try {
      // ✅ Exemple avec Socket.io
      if (global.io) {
        global.io.to(`user_${notification.userId}`).emit('notification', {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          createdAt: notification.createdAt
        });
        console.log(`📱 Notification temps réel envoyée à user_${notification.userId}`);
      }

      // ✅ Envoyer par email pour les notifications importantes
      if (notification.priority === 'high' || notification.priority === 'urgent') {
        await this.sendEmailNotification(notification).catch(err => {
          console.warn('⚠️ Erreur email (non bloquant):', err.message);
        });
      }

      // ✅ Envoyer par SMS pour les notifications urgentes
      if (notification.priority === 'urgent') {
        await this.sendSMSNotification(notification).catch(err => {
          console.warn('⚠️ Erreur SMS (non bloquant):', err.message);
        });
      }
    } catch (error) {
      console.error('❌ Erreur envoi notification temps réel:', error.message);
      // ✅ NE PAS PROPAGER L'ERREUR
    }
  }

  /**
   * ✅ Envoyer notification par email
   */
  async sendEmailNotification(notification) {
    try {
      const user = await User.findByPk(notification.userId);
      
      if (user?.email) {
        await emailService.sendTemplateEmail({
          to: user.email,
          subject: notification.title,
          template: 'notification',
          data: {
            title: notification.title,
            message: notification.message,
            user: {
              firstName: user.firstName || '',
              lastName: user.lastName || ''
            }
          }
        });
        console.log(`📧 Email envoyé à ${user.email}`);
      }
    } catch (error) {
      console.error('❌ Erreur email:', error.message);
      throw error;
    }
  }

  /**
   * ✅ Envoyer notification par SMS
   */
  async sendSMSNotification(notification) {
    try {
      const user = await User.findByPk(notification.userId);
      
      if (user?.phoneNumber) {
        await smsService.sendSMS({
          to: user.phoneNumber,
          message: `${notification.title}: ${notification.message}`
        });
        console.log(`📱 SMS envoyé à ${user.phoneNumber}`);
      }
    } catch (error) {
      console.error('❌ Erreur SMS:', error.message);
      throw error;
    }
  }

  /**
   * ✅ Marquer une notification comme lue
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        where: { id: notificationId, userId }
      });

      if (!notification) {
        throw new Error('Notification non trouvée');
      }

      await notification.update({ isRead: true });
      console.log(`✅ Notification ${notificationId} marquée comme lue`);
      return notification;
    } catch (error) {
      console.error('❌ Erreur marquage notification:', error);
      throw error;
    }
  }

  /**
   * ✅ Récupérer les notifications d'un utilisateur
   */
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

      console.log(`📋 ${notifications.length} notifications récupérées pour l'utilisateur ${userId}`);
      return {
        notifications,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(count / limit),
          totalRecords: count
        }
      };
    } catch (error) {
      console.error('❌ Erreur récupération notifications:', error);
      throw error;
    }
  }

  /**
   * ✅ Marquer toutes les notifications comme lues
   */
  async markAllAsRead(userId) {
    try {
      await Notification.update(
        { isRead: true },
        { where: { userId, isRead: false } }
      );
      console.log(`✅ Toutes les notifications de ${userId} marquées comme lues`);
      return true;
    } catch (error) {
      console.error('❌ Erreur marquage toutes notifications:', error);
      throw error;
    }
  }

  /**
   * ✅ Compter les notifications non lues
   */
  async getUnreadCount(userId) {
    try {
      const count = await Notification.count({
        where: { userId, isRead: false }
      });
      return count;
    } catch (error) {
      console.error('❌ Erreur comptage notifications:', error);
      throw error;
    }
  }
}

// ✅ EXPORT DE L'INSTANCE UNIQUE
module.exports = new NotificationService();
