const notificationService = require('../services/notificationService');
const reminderScheduler = require('../jobs/reminderScheduler');
const { User } = require('../models');

const notificationController = {
  /**
   * Récupérer les notifications de l'utilisateur
   */
  async getUserNotifications(req, res) {
    try {
      const { page, limit, unreadOnly } = req.query;
      
      const result = await notificationService.getUserNotifications(
        req.user.id,
        { page, limit, unreadOnly }
      );

      res.json({
        success: true,
        data: result.notifications,
        pagination: result.pagination,
        unreadCount: result.unreadCount
      });
    } catch (error) {
      console.error('❌ Erreur récupération notifications:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Marquer une notification comme lue
   */
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      
      const notification = await notificationService.markAsRead(id, req.user.id);

      res.json({
        success: true,
        data: notification,
        message: 'Notification marquée comme lue'
      });
    } catch (error) {
      console.error('❌ Erreur marquage notification:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Marquer toutes les notifications comme lues
   */
  async markAllAsRead(req, res) {
    try {
      await notificationService.markAllAsRead(req.user.id);

      res.json({
        success: true,
        message: 'Toutes les notifications ont été marquées comme lues'
      });
    } catch (error) {
      console.error('❌ Erreur marquage toutes:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Compter les notifications non lues
   */
  async getUnreadCount(req, res) {
    try {
      const count = await notificationService.getUnreadCount(req.user.id);

      res.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      console.error('❌ Erreur comptage:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Obtenir les statistiques des notifications
   */
  async getStats(req, res) {
    try {
      const stats = await notificationService.getStats(req.user.id);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ Erreur stats:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Tester l'envoi d'un rappel (admin uniquement)
   */
  async testReminder(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }

      const { appointmentId } = req.params;
      const result = await reminderScheduler.testReminder(appointmentId);

      res.json({
        success: true,
        message: 'Rappel test envoyé',
        data: result
      });
    } catch (error) {
      console.error('❌ Erreur test:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Démarrer/arrêter le planificateur (admin uniquement)
   */
  async toggleScheduler(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }

      const { action } = req.body;

      if (action === 'start') {
        reminderScheduler.start();
      } else if (action === 'stop') {
        reminderScheduler.stop();
      }

      res.json({
        success: true,
        message: `Planificateur ${action === 'start' ? 'démarré' : 'arrêté'}`
      });
    } catch (error) {
      console.error('❌ Erreur toggle scheduler:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};

module.exports = notificationController;
