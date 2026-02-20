const axios = require('axios');
const querystring = require('querystring');

class SMSService {
  constructor() {
    this.apiUrl = 'https://api.smsmode.com/http/1.6/';
    this.accessToken = process.env.SMSMODE_ACCESS_TOKEN;
    this.sender = process.env.SMSMODE_SENDER || 'CarnetSante';
    this.isEnabled = !!(this.accessToken);
    
    if (this.isEnabled) {
      console.log('✅ Service smsmode initialisé avec succès');
    } else {
      console.log('ℹ️ Service smsmode désactivé (accessToken manquant)');
    }
  }

  async sendSMS(to, message) {
    if (!this.isEnabled) {
      console.log('📱 [SIMULATION] SMS vers', to, ':', message);
      return { success: true, simulated: true, messageId: 'simulated-' + Date.now() };
    }

    try {
      const formattedNumber = this.formatPhoneNumber(to);
      
      // Encodage du message en ISO-8859-15 (requis par smsmode)
      const encodedMessage = this.encodeMessage(message);
      
      // Construction des paramètres pour l'API smsmode [citation:2]
      const params = {
        'accessToken': this.accessToken,
        'numero': formattedNumber,
        'message': encodedMessage,
        'emetteur': this.sender,
        'stop': '1'  // Gestion automatique du STOP SMS
      };

      console.log('📤 Envoi SMS via smsmode vers', formattedNumber);
      
      // Appel API en GET (ou POST selon préférence)
      const response = await axios.get(this.apiUrl + 'sendSMS.do', { 
        params: params,
        timeout: 10000
      });

      console.log('✅ Réponse smsmode:', response.data);
      
      // Analyse de la réponse
      // L'API retourne généralement "OK" ou "KO" suivi d'un identifiant [citation:2]
      const responseData = response.data.toString().trim();
      const success = responseData.startsWith('OK');
      
      // Extraire l'ID si disponible (format: "OK;123456")
      let messageId = null;
      if (responseData.includes(';')) {
        messageId = responseData.split(';')[1];
      }
      
      return { 
        success: success, 
        providerId: messageId || Date.now().toString(),
        response: responseData,
        simulated: false 
      };
      
    } catch (error) {
      console.error('❌ Erreur smsmode:', error.response?.data || error.message);
      
      // Log détaillé pour le débogage
      if (error.response) {
        console.error('Détails:', error.response.status, error.response.statusText);
      }
      
      return { success: false, error: error.message, simulated: false };
    }
  }

  // Méthode POST alternative (plus robuste pour les messages longs)
  async sendSMSPost(to, message) {
    if (!this.isEnabled) return this.sendSMS(to, message); // Fallback

    try {
      const formattedNumber = this.formatPhoneNumber(to);
      const encodedMessage = this.encodeMessage(message);
      
      const postData = querystring.stringify({
        'accessToken': this.accessToken,
        'numero': formattedNumber,
        'message': encodedMessage,
        'emetteur': this.sender,
        'stop': '1'
      });

      const response = await axios.post(this.apiUrl + 'sendSMS.do', postData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=ISO-8859-15'
        },
        timeout: 10000
      });

      console.log('✅ Réponse smsmode (POST):', response.data);
      
      const responseData = response.data.toString().trim();
      const success = responseData.startsWith('OK');
      
      return { 
        success: success, 
        providerId: responseData.split(';')[1] || Date.now().toString(),
        simulated: false 
      };
      
    } catch (error) {
      console.error('❌ Erreur smsmode POST:', error.message);
      return { success: false, error: error.message, simulated: false };
    }
  }

  // Encodage du message au format ISO-8859-15 (requis par smsmode) [citation:2][citation:5]
  encodeMessage(message) {
    try {
      // Utilisation de encodeURIComponent puis conversion manuelle si besoin
      // Note: l'API smsmode attend du texte en ISO-8859-15
      return Buffer.from(message, 'utf-8').toString('latin1');
    } catch (e) {
      console.warn('⚠️ Erreur encodage message, utilisation brute');
      return message;
    }
  }

  formatPhoneNumber(phoneNumber) {
    // Nettoie le numéro (garde uniquement les chiffres et le +)
    let cleaned = phoneNumber.toString().replace(/[^\d+]/g, '');
    
    // Si commence par 00, remplacer par +
    if (cleaned.startsWith('00')) {
      cleaned = '+' + cleaned.substring(2);
    }
    
    // Si commence par 0, ajouter l'indicatif (228 pour le Togo par défaut)
    if (cleaned.startsWith('0') && !cleaned.startsWith('+')) {
      cleaned = '+228' + cleaned.substring(1);
    }
    
    // Si pas d'indicatif du tout, ajouter +228
    if (!cleaned.startsWith('+')) {
      if (cleaned.length <= 8) { // Numéro local sans indicatif
        cleaned = '+228' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    }
    
    return cleaned;
  }

  // Vérification du solde de crédits
  async checkBalance() {
    if (!this.isEnabled) return { success: false, simulated: true };

    try {
      const response = await axios.get(this.apiUrl + 'getCredits.do', {
        params: { accessToken: this.accessToken }
      });
      
      console.log('💰 Solde smsmode:', response.data);
      return { success: true, credits: response.data.toString().trim() };
    } catch (error) {
      console.error('❌ Erreur vérification solde:', error.message);
      return { success: false, error: error.message };
    }
  }

  getTemplates() {
    return {
      welcome: (user) => `Bienvenue sur Carnet Santé, ${user.firstName}! Votre code unique: ${user.uniqueCode}`,
      
      appointmentConfirmation: (apt) => {
        const date = new Date(apt.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR');
        const formattedTime = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return `✅ Rendez-vous confirmé le ${formattedDate} à ${formattedTime} avec Dr. ${apt.doctor.lastName}`;
      },
      
      appointmentReminder24h: (apt) => {
        const date = new Date(apt.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR');
        const formattedTime = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return `⏰ RAPPEL: Rendez-vous demain ${formattedDate} à ${formattedTime} avec Dr. ${apt.doctor.lastName}`;
      },
      
      appointmentReminder1h: (apt) => {
        const date = new Date(apt.appointmentDate);
        const formattedTime = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return `⚠️ RAPPEL URGENT: Rendez-vous dans 1 heure (${formattedTime}) avec Dr. ${apt.doctor.lastName}`;
      },
      
      appointmentCancellation: (apt) => {
        const date = new Date(apt.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR');
        const formattedTime = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return `❌ Rendez-vous du ${formattedDate} à ${formattedTime} avec Dr. ${apt.doctor.lastName} a été annulé.`;
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
