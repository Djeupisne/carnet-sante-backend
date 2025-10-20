const twilio = require('twilio');
const { logger } = require('../utils/logger');

class SMSService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async sendSMS({ to, message }) {
    try {
      if (process.env.SMS_ENABLED !== 'true') {
        logger.info('SMS désactivé', { to, message });
        return { sid: 'mock_sid' };
      }

      const result = await this.client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to
      });

      logger.info('SMS envoyé avec succès', { to, message, sid: result.sid });
      return result;
    } catch (error) {
      logger.error('Erreur lors de l\'envoi du SMS', { to, message, error: error.message });
      throw error;
    }
  }

  async sendAppointmentReminder(appointment) {
    const message = `Rappel: Rendez-vous avec le Dr ${appointment.doctor.firstName} ${appointment.doctor.lastName} demain à ${new Date(appointment.appointmentDate).toLocaleTimeString()}`;
    
    return await this.sendSMS({
      to: appointment.patient.phoneNumber,
      message
    });
  }
}

module.exports = new SMSService();