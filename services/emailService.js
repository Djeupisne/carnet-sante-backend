const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isEnabled = false;
    this.initialize();
  }

  initialize() {
    console.log('\n📧 === INITIALISATION SERVICE EMAIL ===');
    console.log('📧 Vérification de la configuration SMTP...');
    
    try {
      // Vérifier les variables d'environnement
      console.log('📧 Variables SMTP:');
      console.log('  - SMTP_HOST:', process.env.SMTP_HOST || '❌ NON DÉFINI');
      console.log('  - SMTP_PORT:', process.env.SMTP_PORT || '❌ NON DÉFINI');
      console.log('  - SMTP_USER:', process.env.SMTP_USER || '❌ NON DÉFINI');
      console.log('  - SMTP_PASS:', process.env.SMTP_PASS ? '✅ présent (cache)' : '❌ NON DÉFINI');
      console.log('  - SMTP_SECURE:', process.env.SMTP_SECURE || 'false');

      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('⚠️ Configuration SMTP incomplète, les emails seront simulés');
        console.warn('   Manquant:', {
          host: !process.env.SMTP_HOST ? 'SMTP_HOST' : null,
          user: !process.env.SMTP_USER ? 'SMTP_USER' : null,
          pass: !process.env.SMTP_PASS ? 'SMTP_PASS' : null
        });
        this.isEnabled = false;
        return;
      }

      console.log('📧 Création du transporteur SMTP...');
      
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false,
          ciphers: 'SSLv3'
        },
        debug: true, // Activer le debug
        logger: true // Logger les messages
      });

      console.log('📧 Vérification de la connexion SMTP...');
      
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('❌ ERREUR DE CONNEXION SMTP:');
          console.error('  - Message:', error.message);
          console.error('  - Code:', error.code);
          console.error('  - Commande:', error.command);
          console.error('  - Réponse:', error.response);
          this.isEnabled = false;
        } else {
          console.log('✅ SUCCÈS: Service email prêt - Connexion SMTP établie');
          console.log('✅ Serveur SMTP répondant:', success);
          this.isEnabled = true;
        }
      });

    } catch (error) {
      console.error('❌ EXCEPTION lors de l\'initialisation email:');
      console.error('  - Message:', error.message);
      console.error('  - Stack:', error.stack);
      this.isEnabled = false;
    }
    
    console.log('📧 === FIN INITIALISATION ===\n');
  }

  async sendEmail({ to, subject, html, text, from = process.env.SMTP_FROM }) {
    console.log(`\n📧 Tentative d'envoi d'email:`);
    console.log(`  - À: ${to}`);
    console.log(`  - Sujet: ${subject}`);
    console.log(`  - Service activé: ${this.isEnabled}`);
    console.log(`  - Transporteur: ${this.transporter ? '✓ présent' : '✗ absent'}`);

    if (!this.isEnabled || !this.transporter) {
      console.log('📧 [SIMULATION] Email simulé car service non disponible');
      console.log(`  - À: ${to}`);
      console.log(`  - Sujet: ${subject}`);
      return { 
        success: true, 
        simulated: true, 
        messageId: 'simulated-' + Date.now(),
        note: 'Email simulé - service SMTP non disponible'
      };
    }

    try {
      const mailOptions = {
        from: from || '"Carnet Santé" <noreply@carnetsante.com>',
        to,
        subject,
        html,
        text
      };

      console.log('📧 Envoi via SMTP...');
      console.log('  - Options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        htmlLength: mailOptions.html?.length || 0
      });

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email envoyé avec succès!');
      console.log('  - MessageId:', result.messageId);
      console.log('  - Réponse:', result.response);
      
      logger.info('Email envoyé avec succès', { to, subject, messageId: result.messageId });
      return { success: true, messageId: result.messageId, simulated: false };
    } catch (error) {
      console.error('❌ ERREUR ENVOI EMAIL:');
      console.error('  - Message:', error.message);
      console.error('  - Code:', error.code);
      console.error('  - Commande:', error.command);
      console.error('  - Réponse:', error.response);
      console.error('  - Stack:', error.stack);
      
      logger.error('Erreur envoi email:', { to, subject, error: error.message });
      return { success: false, error: error.message, simulated: false };
    }
  }

  // Templates d'emails
  getTemplates() {
    return {
      welcome: (user) => ({
        subject: `Bienvenue sur Carnet Santé, ${user.firstName}!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <h1 style="color: #2563eb; text-align: center;">Carnet Santé</h1>
            <h2>Bienvenue ${user.firstName} ${user.lastName} !</h2>
            <p>Votre compte a été créé avec succès.</p>
            <p><strong>Code unique:</strong> ${user.uniqueCode}</p>
            <p><strong>Rôle:</strong> ${user.role === 'patient' ? 'Patient' : 'Médecin'}</p>
            <a href="${process.env.FRONTEND_URL}/login" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Se connecter</a>
          </div>
        `,
        text: `Bienvenue sur Carnet Santé, ${user.firstName} ${user.lastName}! Votre code unique: ${user.uniqueCode}`
      }),

      appointmentConfirmation: (appointment) => {
        const date = new Date(appointment.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const formattedTime = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        return {
          subject: `✅ Rendez-vous confirmé - Dr. ${appointment.doctor.lastName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
              <h1 style="color: #2563eb; text-align: center;">Carnet Santé</h1>
              <div style="background: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #047857; font-weight: bold; text-align: center;">✅ Votre rendez-vous a été confirmé</p>
              </div>
              <p><strong>Médecin:</strong> Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Heure:</strong> ${formattedTime}</p>
              <p><strong>Motif:</strong> ${appointment.reason || 'Non spécifié'}</p>
              ${appointment.type === 'teleconsultation' ? `<p><strong>Lien:</strong> <a href="${appointment.meetingLink}">${appointment.meetingLink}</a></p>` : ''}
            </div>
          `,
          text: `Rendez-vous confirmé avec Dr. ${appointment.doctor.lastName} le ${formattedDate} à ${formattedTime}`
        };
      },

      appointmentReminder: (appointment, hoursBefore) => {
        const date = new Date(appointment.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const formattedTime = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        return {
          subject: `⏰ Rappel: Rendez-vous ${hoursBefore === 24 ? 'demain' : 'dans 1 heure'}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
              <h1 style="color: #2563eb; text-align: center;">Carnet Santé</h1>
              <div style="background: #fef9c3; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #854d0e; font-weight: bold; text-align: center;">⏰ Rappel: Rendez-vous ${hoursBefore === 24 ? 'demain' : 'dans 1 heure'}</p>
              </div>
              <p><strong>Médecin:</strong> Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Heure:</strong> ${formattedTime}</p>
            </div>
          `,
          text: `Rappel: Rendez-vous avec Dr. ${appointment.doctor.lastName} le ${formattedDate} à ${formattedTime}`
        };
      },

      appointmentCancellation: (appointment) => {
        const date = new Date(appointment.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const formattedTime = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        return {
          subject: `❌ Rendez-vous annulé - Dr. ${appointment.doctor.lastName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
              <h1 style="color: #2563eb; text-align: center;">Carnet Santé</h1>
              <div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #b91c1c; font-weight: bold; text-align: center;">❌ Rendez-vous annulé</p>
              </div>
              <p><strong>Médecin:</strong> Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Heure:</strong> ${formattedTime}</p>
              ${appointment.cancellationReason ? `<p><strong>Raison:</strong> ${appointment.cancellationReason}</p>` : ''}
            </div>
          `,
          text: `Rendez-vous avec Dr. ${appointment.doctor.lastName} du ${formattedDate} à ${formattedTime} a été annulé.`
        };
      }
    };
  }

  async sendTemplate(type, data, to) {
    console.log(`📧 Envoi template "${type}" à ${to}`);
    const templates = this.getTemplates();
    const template = templates[type]?.(data);
    if (!template) {
      console.error(`❌ Template "${type}" non trouvé`);
      return { success: false, error: 'Template non trouvé' };
    }
    return await this.sendEmail({ 
      to, 
      subject: template.subject, 
      html: template.html, 
      text: template.text 
    });
  }
}

module.exports = new EmailService();
