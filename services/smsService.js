const twilio = require('twilio');

class SMSService {
  constructor() {
    // ✅ Initialisation conditionnelle de Twilio (ne bloque pas le démarrage)
    this.isEnabled = process.env.SMS_ENABLED === 'true';
    this.client = null;
    
    if (this.isEnabled) {
      // Vérifier que les credentials existent
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        try {
          this.client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
          );
          this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
          console.log('✅ Service SMS Twilio initialisé');
        } catch (error) {
          console.warn('⚠️ Erreur initialisation Twilio:', error.message);
          console.warn('📱 Le service SMS fonctionnera en mode simulation');
          this.isEnabled = false;
        }
      } else {
        console.warn('⚠️ Credentials Twilio manquantes - SMS désactivé');
        this.isEnabled = false;
      }
    } else {
      console.log('ℹ️ Service SMS désactivé (SMS_ENABLED != true)');
    }
  }

  async sendSMS(to, message) {
    // Si SMS désactivé, simuler l'envoi (ne pas faire échouer)
    if (!this.isEnabled || !this.client) {
      console.log('📱 [SIMULATION] SMS vers', to, ':', message);
      return {
        success: true,
        simulated: true,
        message: 'SMS simulé (service désactivé)'
      };
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.phoneNumber,
        to: to
      });

      console.log('✅ SMS envoyé avec succès:', result.sid);
      return {
        success: true,
        messageId: result.sid,
        simulated: false
      };
    } catch (error) {
      console.error('❌ Erreur envoi SMS:', error.message);
      // Ne pas faire échouer l'application, juste logger
      return {
        success: false,
        error: error.message,
        simulated: false
      };
    }
  }

  async sendVerificationCode(phoneNumber, code) {
    const message = `Votre code de vérification Carnet de Santé: ${code}. Valide 10 minutes.`;
    return await this.sendSMS(phoneNumber, message);
  }

  async sendAppointmentReminder(phoneNumber, appointmentDetails) {
    const message = `Rappel: Rendez-vous ${appointmentDetails.date} à ${appointmentDetails.time} avec Dr. ${appointmentDetails.doctor}`;
    return await this.sendSMS(phoneNumber, message);
  }

  async sendAppointmentConfirmation(phoneNumber, appointmentDetails) {
    const message = `Confirmation: Rendez-vous le ${appointmentDetails.date} à ${appointmentDetails.time}. Carnet de Santé`;
    return await this.sendSMS(phoneNumber, message);
  }

  getStatus() {
    return {
      enabled: this.isEnabled,
      ready: this.client !== null,
      provider: 'Twilio'
    };
  }
}

// Export une instance unique
module.exports = new SMSService();