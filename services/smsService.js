const twilio = require('twilio');

class SMSService {
  constructor() {
    this.isEnabled = false;
    this.client = null;
    this.phoneNumber = null;
    this.initialize();
  }

  initialize() {
    // Vérifier si SMS activé
    if (process.env.SMS_ENABLED !== 'true') {
      console.log('ℹ️ Service SMS désactivé (SMS_ENABLED != true)');
      return;
    }

    // Vérifier les credentials Twilio
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      console.warn('⚠️ Credentials Twilio manquants - SMS désactivé');
      return;
    }

    try {
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
      this.isEnabled = true;
      console.log('✅ Service SMS Twilio initialisé');
    } catch (error) {
      console.warn('⚠️ Erreur initialisation Twilio:', error.message);
      this.isEnabled = false;
    }
  }

  async sendSMS(to, message, options = {}) {
    // Mode simulation
    if (!this.isEnabled || !this.client) {
      console.log('📱 [SIMULATION] SMS vers', to);
      console.log('Message:', message);
      return {
        success: true,
        simulated: true,
        messageId: 'simulated-' + Date.now()
      };
    }

    try {
      // Formater le numéro de téléphone
      const formattedNumber = this.formatPhoneNumber(to);
      
      const result = await this.client.messages.create({
        body: message,
        from: this.phoneNumber,
        to: formattedNumber,
        ...options
      });

      console.log('✅ SMS envoyé avec succès:', result.sid);
      return {
        success: true,
        messageId: result.sid,
        simulated: false
      };
    } catch (error) {
      console.error('❌ Erreur envoi SMS:', error.message);
      return {
        success: false,
        error: error.message,
        simulated: false
      };
    }
  }

  formatPhoneNumber(phoneNumber) {
    // Supprimer tous les caractères non numériques
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Si le numéro commence par 0, remplacer par +228 (Togo)
    if (cleaned.startsWith('0')) {
      cleaned = '228' + cleaned.substring(1);
    }
    
    // Si pas de code pays, ajouter +228
    if (!cleaned.startsWith('228') && !cleaned.startsWith('+')) {
      cleaned = '228' + cleaned;
    }
    
    // Ajouter le + si nécessaire
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  }

  // Templates SMS
  getTemplates() {
    return {
      welcome: (user) => ({
        message: `Bienvenue sur Carnet Santé, ${user.firstName} ! Votre code unique: ${user.uniqueCode}. Connectez-vous pour commencer.`
      }),

      appointmentConfirmation: (appointment) => {
        const date = new Date(appointment.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        });

        return {
          message: `✅ Rendez-vous confirmé: ${formattedDate} à ${formattedTime} avec Dr. ${appointment.doctor.lastName}. ${appointment.type === 'teleconsultation' ? 'Lien de visio sur votre email.' : ''}`
        };
      },

      appointmentReminder24h: (appointment) => {
        const date = new Date(appointment.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        });

        return {
          message: `⏰ RAPPEL: Rendez-vous demain ${formattedDate} à ${formattedTime} avec Dr. ${appointment.doctor.lastName}.`
        };
      },

      appointmentReminder1h: (appointment) => {
        const date = new Date(appointment.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        });

        return {
          message: `⏰ RAPPEL URGENT: Rendez-vous dans 1 heure (${formattedDate} à ${formattedTime}) avec Dr. ${appointment.doctor.lastName}.`
        };
      },

      appointmentCancellation: (appointment) => {
        const date = new Date(appointment.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        });

        return {
          message: `❌ Rendez-vous du ${formattedDate} à ${formattedTime} avec Dr. ${appointment.doctor.lastName} a été annulé.`
        };
      }
    };
  }

  async sendTemplate(type, data, to) {
    const templates = this.getTemplates();
    const template = templates[type]?.(data);
    
    if (!template) {
      console.error(`❌ Template SMS "${type}" non trouvé`);
      return { success: false, error: 'Template non trouvé' };
    }

    return await this.sendSMS(to, template.message);
  }

  getStatus() {
    return {
      enabled: this.isEnabled,
      phoneNumber: this.phoneNumber,
      provider: 'Twilio'
    };
  }
}

module.exports = new SMSService();
