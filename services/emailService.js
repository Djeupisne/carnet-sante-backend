const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isEnabled = false;
    this.initialize();
  }

  initialize() {
    try {
      // Vérifier les variables d'environnement
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('⚠️ Configuration SMTP manquante, les emails seront simulés');
        this.isEnabled = false;
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Vérifier la connexion
      this.transporter.verify((error, success) => {
        if (error) {
          console.warn('⚠️ Erreur de connexion SMTP:', error.message);
          this.isEnabled = false;
        } else {
          console.log('✅ Service email prêt');
          this.isEnabled = true;
        }
      });
    } catch (error) {
      console.warn('⚠️ Erreur initialisation email:', error.message);
      this.isEnabled = false;
    }
  }

  async sendEmail({ to, subject, html, text, from = process.env.SMTP_FROM }) {
    try {
      // Mode simulation si désactivé
      if (!this.isEnabled || !this.transporter) {
        console.log('📧 [SIMULATION] Email à', to);
        console.log('Sujet:', subject);
        console.log('Contenu:', text || html?.substring(0, 200) + '...');
        return {
          success: true,
          simulated: true,
          messageId: 'simulated-' + Date.now()
        };
      }

      const mailOptions = {
        from: from || process.env.SMTP_FROM || '"Carnet Santé" <noreply@carnetsante.com>',
        to,
        subject,
        html,
        text
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info('Email envoyé avec succès', {
        to,
        subject,
        messageId: result.messageId
      });

      return {
        success: true,
        messageId: result.messageId,
        simulated: false
      };
    } catch (error) {
      logger.error('Erreur lors de l\'envoi de l\'email', {
        to,
        subject,
        error: error.message
      });
      return {
        success: false,
        error: error.message,
        simulated: false
      };
    }
  }

  // Templates d'emails
  getTemplates() {
    return {
      // Email de bienvenue
      welcome: (user) => ({
        subject: `Bienvenue sur Carnet Santé, ${user.firstName || ''}!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Carnet Santé</h1>
              <p style="color: #6b7280;">Votre santé, notre priorité</p>
            </div>
            
            <h2 style="color: #111827;">Bienvenue ${user.firstName} ${user.lastName} !</h2>
            
            <p style="color: #374151; line-height: 1.6;">
              Nous sommes ravis de vous accueillir sur Carnet Santé. Votre compte a été créé avec succès.
            </p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Code unique:</strong> ${user.uniqueCode}</p>
              <p style="margin: 5px 0;"><strong>Rôle:</strong> ${user.role === 'patient' ? 'Patient' : 'Médecin'}</p>
            </div>
            
            <p style="color: #374151;">
              Connectez-vous dès maintenant pour découvrir toutes nos fonctionnalités :
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://carnet-sante-frontend.onrender.com'}/login" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                Se connecter
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
            
            <p style="color: #6b7280; font-size: 12px; text-align: center;">
              Cet email est automatique, merci de ne pas y répondre.
            </p>
          </div>
        `,
        text: `
          Bienvenue sur Carnet Santé, ${user.firstName} ${user.lastName}!
          
          Votre compte a été créé avec succès.
          
          Code unique: ${user.uniqueCode}
          Rôle: ${user.role === 'patient' ? 'Patient' : 'Médecin'}
          
          Connectez-vous ici: ${process.env.FRONTEND_URL || 'https://carnet-sante-frontend.onrender.com'}/login
        `
      }),

      // Confirmation de rendez-vous
      appointmentConfirmation: (appointment) => {
        const date = new Date(appointment.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        });

        return {
          subject: `✅ Rendez-vous confirmé - Dr. ${appointment.doctor.lastName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #2563eb;">Carnet Santé</h1>
              </div>
              
              <div style="background-color: #d1fae5; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <p style="color: #047857; margin: 0; font-weight: bold; text-align: center;">
                  ✅ Votre rendez-vous a été confirmé
                </p>
              </div>
              
              <h2 style="color: #111827;">Détails du rendez-vous</h2>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 10px 0;"><strong>Patient:</strong> ${appointment.patient.firstName} ${appointment.patient.lastName}</p>
                <p style="margin: 10px 0;"><strong>Médecin:</strong> Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}</p>
                <p style="margin: 10px 0;"><strong>Spécialité:</strong> ${appointment.doctor.specialty || 'Généraliste'}</p>
                <p style="margin: 10px 0;"><strong>Date:</strong> ${formattedDate}</p>
                <p style="margin: 10px 0;"><strong>Heure:</strong> ${formattedTime}</p>
                <p style="margin: 10px 0;"><strong>Durée:</strong> ${appointment.duration} minutes</p>
                <p style="margin: 10px 0;"><strong>Type:</strong> ${
                  appointment.type === 'in_person' ? '👤 En personne' :
                  appointment.type === 'teleconsultation' ? '📱 Téléconsultation' :
                  '🏠 Visite à domicile'
                }</p>
                <p style="margin: 10px 0;"><strong>Motif:</strong> ${appointment.reason || 'Non spécifié'}</p>
              </div>
              
              ${appointment.type === 'teleconsultation' ? `
                <div style="background-color: #e0f2fe; border: 1px solid #0284c7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                  <p style="color: #0369a1; margin: 0; font-weight: bold; text-align: center;">
                    🔗 Lien de téléconsultation:
                  </p>
                  <p style="text-align: center; margin: 10px 0;">
                    <a href="${appointment.meetingLink}" style="color: #2563eb;">Cliquez ici pour rejoindre la consultation</a>
                  </p>
                </div>
              ` : ''}
              
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
              
              <p style="color: #6b7280; font-size: 12px; text-align: center;">
                Pour annuler ou modifier, connectez-vous à votre espace.
              </p>
            </div>
          `,
          text: `
            ✅ Votre rendez-vous a été confirmé
            
            Patient: ${appointment.patient.firstName} ${appointment.patient.lastName}
            Médecin: Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}
            Date: ${formattedDate} à ${formattedTime}
            Motif: ${appointment.reason || 'Non spécifié'}
            
            ${appointment.type === 'teleconsultation' ? `Lien: ${appointment.meetingLink}` : ''}
          `
        };
      },

      // Rappel de rendez-vous (24h avant)
      appointmentReminder: (appointment, hoursBefore = 24) => {
        const date = new Date(appointment.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        });

        return {
          subject: `⏰ Rappel: Rendez-vous ${hoursBefore === 24 ? 'demain' : 'dans 1 heure'}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #2563eb;">Carnet Santé</h1>
              </div>
              
              <div style="background-color: #fef9c3; border: 1px solid #eab308; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <p style="color: #854d0e; margin: 0; font-weight: bold; text-align: center;">
                  ⏰ Rappel: ${hoursBefore === 24 ? 'Vous avez un rendez-vous demain' : 'Votre rendez-vous est dans 1 heure'}
                </p>
              </div>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px;">
                <p style="margin: 10px 0;"><strong>Médecin:</strong> Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}</p>
                <p style="margin: 10px 0;"><strong>Date:</strong> ${formattedDate}</p>
                <p style="margin: 10px 0;"><strong>Heure:</strong> ${formattedTime}</p>
                <p style="margin: 10px 0;"><strong>Type:</strong> ${
                  appointment.type === 'in_person' ? '👤 En personne' :
                  appointment.type === 'teleconsultation' ? '📱 Téléconsultation' :
                  '🏠 Visite à domicile'
                }</p>
              </div>
              
              ${appointment.type === 'teleconsultation' ? `
                <p style="margin: 15px 0;">
                  <strong>Lien:</strong> <a href="${appointment.meetingLink}" style="color: #2563eb;">${appointment.meetingLink}</a>
                </p>
              ` : ''}
              
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
              
              <p style="color: #6b7280; font-size: 12px; text-align: center;">
                Pour toute modification, connectez-vous à votre espace patient.
              </p>
            </div>
          `,
          text: `
            ⏰ RAPPEL: ${hoursBefore === 24 ? 'Rendez-vous demain' : 'Rendez-vous dans 1 heure'}
            
            Médecin: Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}
            Date: ${formattedDate} à ${formattedTime}
            ${appointment.type === 'teleconsultation' ? `Lien: ${appointment.meetingLink}` : ''}
          `
        };
      },

      // Annulation de rendez-vous
      appointmentCancellation: (appointment) => {
        const date = new Date(appointment.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        });

        return {
          subject: `❌ Rendez-vous annulé - Dr. ${appointment.doctor.lastName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
              <div style="background-color: #fee2e2; border: 1px solid #ef4444; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <p style="color: #b91c1c; margin: 0; font-weight: bold; text-align: center;">
                  ❌ Rendez-vous annulé
                </p>
              </div>
              
              <p>Le rendez-vous suivant a été annulé :</p>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px;">
                <p><strong>Médecin:</strong> Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}</p>
                <p><strong>Date:</strong> ${formattedDate} à ${formattedTime}</p>
                ${appointment.cancellationReason ? `<p><strong>Raison:</strong> ${appointment.cancellationReason}</p>` : ''}
              </div>
              
              <p style="margin-top: 20px;">
                Vous pouvez reprendre un nouveau rendez-vous depuis votre espace.
              </p>
            </div>
          `,
          text: `
            ❌ Rendez-vous annulé
            
            Médecin: Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}
            Date: ${formattedDate} à ${formattedTime}
            ${appointment.cancellationReason ? `Raison: ${appointment.cancellationReason}` : ''}
          `
        };
      }
    };
  }

  // Envoyer un email avec template
  async sendTemplate(type, data, to) {
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
