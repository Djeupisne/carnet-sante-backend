const cron = require('node-cron');
const { Op } = require('sequelize');
const { Appointment, User } = require('../models');
const notificationService = require('../services/notificationService');
const { logger } = require('../utils/logger');

class ReminderScheduler {
  constructor() {
    this.isRunning = false;
    this.jobs = [];
  }

  /**
   * Démarrer tous les planificateurs
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Planificateur déjà en cours');
      return;
    }

    console.log('🚀 Démarrage du planificateur de rappels...');

    // Vérifier toutes les heures
    this.jobs.push(
      cron.schedule('0 * * * *', () => {
        this.checkAppointments().catch(err => {
          console.error('❌ Erreur planificateur:', err);
        });
      })
    );

    // Nettoyage quotidien à 3h du matin
    this.jobs.push(
      cron.schedule('0 3 * * *', () => {
        this.cleanup().catch(err => {
          console.error('❌ Erreur nettoyage:', err);
        });
      })
    );

    this.isRunning = true;
    console.log('✅ Planificateur de rappels démarré');
  }

  /**
   * Arrêter tous les planificateurs
   */
  stop() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    this.isRunning = false;
    console.log('🛑 Planificateur arrêté');
  }

  /**
   * Vérifier les rendez-vous à venir
   */
  async checkAppointments() {
    console.log('🔍 Vérification des rendez-vous à venir...');
    
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);

    // Rendez-vous dans 24h (entre 23h et 25h)
    const appointments24h = await Appointment.findAll({
      where: {
        status: 'confirmed',
        appointmentDate: {
          [Op.between]: [
            new Date(now.getTime() + 23.5 * 60 * 60 * 1000),
            new Date(now.getTime() + 24.5 * 60 * 60 * 1000)
          ]
        }
      },
      include: [
        { model: User, as: 'patient' },
        { model: User, as: 'doctor' }
      ]
    });

    // Rendez-vous dans 1h (entre 55min et 65min)
    const appointments1h = await Appointment.findAll({
      where: {
        status: 'confirmed',
        appointmentDate: {
          [Op.between]: [
            new Date(now.getTime() + 55 * 60 * 1000),
            new Date(now.getTime() + 65 * 60 * 1000)
          ]
        }
      },
      include: [
        { model: User, as: 'patient' },
        { model: User, as: 'doctor' }
      ]
    });

    // Envoyer les rappels 24h
    for (const apt of appointments24h) {
      console.log(`📧 Envoi rappel 24h pour rendez-vous ${apt.id}`);
      await notificationService.sendAppointmentReminder(apt, 24);
    }

    // Envoyer les rappels 1h
    for (const apt of appointments1h) {
      console.log(`📱 Envoi rappel 1h pour rendez-vous ${apt.id}`);
      await notificationService.sendAppointmentReminder(apt, 1);
    }

    console.log(`✅ Vérification terminée: ${appointments24h.length} rappels 24h, ${appointments1h.length} rappels 1h`);
  }

  /**
   * Nettoyer les anciennes notifications
   */
  async cleanup() {
    console.log('🧹 Nettoyage des anciennes notifications...');
    await notificationService.cleanupOldNotifications(30);
    console.log('✅ Nettoyage terminé');
  }

  /**
   * Tester l'envoi d'un rappel manuel
   */
  async testReminder(appointmentId) {
    const appointment = await Appointment.findByPk(appointmentId, {
      include: [
        { model: User, as: 'patient' },
        { model: User, as: 'doctor' }
      ]
    });

    if (!appointment) {
      throw new Error('Rendez-vous non trouvé');
    }

    await notificationService.sendAppointmentReminder(appointment, 1);
    return { success: true, message: 'Test envoyé' };
  }
}

module.exports = new ReminderScheduler();
