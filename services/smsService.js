const axios = require('axios');

class SMSService {
  constructor() {
    this.apiUrl = 'https://api.www.allmysms.com/http/9.0/sendSms/';
    this.login = process.env.ALLMYSMS_LOGIN;
    this.apiKey = process.env.ALLMYSMS_APIKEY;
    this.sender = process.env.ALLMYSMS_SENDER || 'CarnetSante';
    this.isEnabled = !!(this.login && this.apiKey);
    
    if (this.isEnabled) {
      console.log('✅ Service AllMySMS initialisé');
    } else {
      console.log('ℹ️ Service AllMySMS désactivé (identifiants manquants)');
    }
  }

  async sendSMS(to, message) {
    if (!this.isEnabled) {
      console.log('📱 [SIMULATION] SMS vers', to, ':', message);
      return { success: true, simulated: true, messageId: 'simulated-' + Date.now() };
    }

    try {
      const formattedNumber = this.formatPhoneNumber(to);
      
      // Format XML pour AllMySMS
      const smsData = `
        <DATA>
          <MESSAGE><![CDATA[${message}]]></MESSAGE>
          <TPOA>${this.sender}</TPOA>
          <SMS>
            <MOBILEPHONE>${formattedNumber}</MOBILEPHONE>
          </SMS>
        </DATA>
      `;

      console.log('📤 Envoi SMS via AllMySMS vers', formattedNumber);
      
      const response = await axios.post(this.apiUrl, null, {
        params: {
          login: this.login,
          apiKey: this.apiKey,
          smsData: smsData
        }
      });

      console.log('✅ SMS envoyé via AllMySMS:', response.data);
      
      // AllMySMS retourne un code comme "OK;1;2025-01-20 10:30:00;123456"
      const parts = response.data.split(';');
      const success = parts[0] === 'OK';
      
      return { 
        success: success, 
        providerId: parts[4] || Date.now().toString(),
        simulated: false 
      };
    } catch (error) {
      console.error('❌ Erreur AllMySMS:', error.response?.data || error.message);
      return { success: false, error: error.message, simulated: false };
    }
  }

  formatPhoneNumber(phoneNumber) {
    // Nettoie le numéro
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Si commence par 0, remplacer par l'indicatif (228 pour le Togo)
    if (cleaned.startsWith('0')) {
      cleaned = '228' + cleaned.substring(1);
    }
    
    // Si pas d'indicatif, ajouter 228 (Togo par défaut)
    if (!cleaned.startsWith('228') && !cleaned.startsWith('+')) {
      cleaned = '228' + cleaned;
    }
    
    // Ajouter + si nécessaire
    return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
  }

  getTemplates() {
    return {
      welcome: (user) => `Bienvenue sur Carnet Santé, ${user.firstName}! Votre code unique: ${user.uniqueCode}`,
      
      appointmentConfirmation: (apt) => {
        const date = new Date(apt.appointmentDate);
        return `✅ Rendez-vous confirmé le ${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} avec Dr. ${apt.doctor.lastName}`;
      },
      
      appointmentReminder24h: (apt) => {
        const date = new Date(apt.appointmentDate);
        return `⏰ RAPPEL: Rendez-vous demain ${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} avec Dr. ${apt.doctor.lastName}`;
      },
      
      appointmentReminder1h: (apt) => {
        const date = new Date(apt.appointmentDate);
        return `⚠️ RAPPEL: Rendez-vous dans 1 heure (${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}) avec Dr. ${apt.doctor.lastName}`;
      },
      
      appointmentCancellation: (apt) => {
        const date = new Date(apt.appointmentDate);
        return `❌ Rendez-vous du ${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} avec Dr. ${apt.doctor.lastName} a été annulé.`;
      }
    };
  }

  async sendTemplate(type, data, to) {
    const templates = this.getTemplates();
    const message = templates[type]?.(data);
    if (!message) return { success: false, error: 'Template non trouvé' };
    return await this.sendSMS(to, message);
  }
}

module.exports = new SMSService();
