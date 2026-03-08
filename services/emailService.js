// services/emailService.js
const nodemailer = require('nodemailer');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://carnet-sante-frontend.onrender.com';

class EmailService {
  constructor() {
    this.transporter = null;
    this.isEnabled = false;
    this.initialize();
  }

  initialize() {
    console.log('\n📧 === INITIALISATION SERVICE EMAIL ===');
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    console.log('  - SMTP_HOST :', SMTP_HOST || '❌ NON DÉFINI');
    console.log('  - SMTP_PORT :', SMTP_PORT || '❌ NON DÉFINI');
    console.log('  - SMTP_USER :', SMTP_USER || '❌ NON DÉFINI');
    console.log('  - SMTP_PASS :', SMTP_PASS ? '✅ présent' : '❌ NON DÉFINI');

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.warn('⚠️  Configuration SMTP incomplète – service désactivé');
      return;
    }

    const port   = parseInt(SMTP_PORT || '587');
    const secure = port === 465; // true = SSL (465), false = STARTTLS (587)

    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 15000,
      greetingTimeout:   15000,
      socketTimeout:     30000
      // ❌ Pas de tls.ciphers: 'SSLv3' – obsolète et rejeté par Gmail
    });

    this.transporter.verify((error) => {
      if (error) {
        console.error('❌ Connexion SMTP échouée :', error.message);
        this.isEnabled = false;
      } else {
        console.log('✅ Connexion SMTP vérifiée avec succès');
        this.isEnabled = true;
      }
    });

    this.isEnabled = true;
    console.log('📧 === FIN INITIALISATION ===\n');
  }

  /**
   * Envoie un email brut. Lève une exception en cas d'échec (pas de simulation silencieuse).
   */
  async sendEmail({ to, subject, html, text, from }) {
    console.log(`\n📧 Envoi → ${to} | ${subject}`);

    if (!this.transporter) {
      throw new Error('Transporteur SMTP non configuré (variables SMTP_* manquantes)');
    }

    const result = await Promise.race([
      this.transporter.sendMail({
        from: from || `"Carnet Santé" <${process.env.SMTP_USER}>`,
        to, subject, html, text
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout SMTP (30 s)')), 30000)
      )
    ]);

    console.log('✅ Email envoyé – MessageId:', result.messageId);
    return { success: true, messageId: result.messageId, simulated: false };
  }

  getTemplates() {
    return {

      // ── Bienvenue ────────────────────────────────────────────────────────────
      welcome: (user) => ({
        subject: `Bienvenue sur Carnet Santé, ${user.firstName} !`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:28px;border:1px solid #e0e0e0;border-radius:10px;">
            <h1 style="color:#2563eb;text-align:center;margin-bottom:4px;">🏥 Carnet Santé</h1>
            <h2 style="text-align:center;color:#374151;">Bienvenue ${user.firstName} ${user.lastName} !</h2>
            <p>Votre compte a été créé avec succès.</p>
            <p><strong>Code unique :</strong>
              <code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;">${user.uniqueCode}</code>
            </p>
            <p><strong>Rôle :</strong> ${user.role === 'patient' ? 'Patient' : 'Médecin'}</p>
            <div style="text-align:center;margin:30px 0;">
              <a href="${FRONTEND_URL}/login"
                 style="display:inline-block;padding:12px 28px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">
                Se connecter
              </a>
            </div>
          </div>`,
        text: `Bienvenue sur Carnet Santé, ${user.firstName} ! Code unique : ${user.uniqueCode}`
      }),

      // ── Mot de passe oublié ──────────────────────────────────────────────────
      forgotPassword: ({ resetLink, firstName, expiryMinutes = 60 }) => ({
        subject: '🔑 Réinitialisation de votre mot de passe – Carnet Santé',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:28px;border:1px solid #e0e0e0;border-radius:10px;">
            <h1 style="color:#2563eb;text-align:center;">🏥 Carnet Santé</h1>

            <div style="background:#fef9c3;padding:14px 18px;border-radius:8px;border-left:4px solid #f59e0b;margin:20px 0;">
              <p style="margin:0;color:#92400e;font-weight:bold;">Demande de réinitialisation de mot de passe</p>
            </div>

            <p>Bonjour <strong>${firstName}</strong>,</p>
            <p>Nous avons reçu une demande de réinitialisation du mot de passe associé à votre compte.</p>
            <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>

            <div style="text-align:center;margin:32px 0;">
              <a href="${resetLink}"
                 style="display:inline-block;padding:14px 32px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">
                Réinitialiser mon mot de passe
              </a>
            </div>

            <p style="color:#6b7280;font-size:14px;">
              ⏳ Ce lien est valable <strong>${expiryMinutes} minutes</strong> et ne peut être utilisé qu'une seule fois.
            </p>
            <p style="color:#6b7280;font-size:14px;">
              Si vous n'avez pas effectué cette demande, ignorez cet email – votre mot de passe restera inchangé.
            </p>

            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
            <p style="color:#9ca3af;font-size:12px;text-align:center;">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
              <a href="${resetLink}" style="color:#2563eb;word-break:break-all;">${resetLink}</a>
            </p>
          </div>`,
        text: `Bonjour ${firstName},\n\nRéinitialisez votre mot de passe (valable ${expiryMinutes} min) :\n${resetLink}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`
      }),

      // ── Confirmation de changement de mot de passe ───────────────────────────
      passwordChanged: ({ firstName }) => ({
        subject: '✅ Mot de passe modifié avec succès – Carnet Santé',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:28px;border:1px solid #e0e0e0;border-radius:10px;">
            <h1 style="color:#2563eb;text-align:center;">🏥 Carnet Santé</h1>
            <div style="background:#d1fae5;padding:14px 18px;border-radius:8px;border-left:4px solid #10b981;margin:20px 0;">
              <p style="margin:0;color:#065f46;font-weight:bold;">✅ Mot de passe modifié avec succès</p>
            </div>
            <p>Bonjour <strong>${firstName}</strong>,</p>
            <p>Votre mot de passe a bien été réinitialisé. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
            <p style="color:#6b7280;font-size:14px;">
              Si vous n'êtes pas à l'origine de cette modification, connectez-vous immédiatement pour sécuriser votre compte.
            </p>
            <div style="text-align:center;margin:30px 0;">
              <a href="${FRONTEND_URL}/login"
                 style="display:inline-block;padding:12px 28px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">
                Se connecter
              </a>
            </div>
          </div>`,
        text: `Bonjour ${firstName}, votre mot de passe Carnet Santé a été modifié avec succès.`
      }),

      // ── Confirmation de RDV ──────────────────────────────────────────────────
      appointmentConfirmation: (appointment) => {
        const date          = new Date(appointment.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
        const formattedTime = date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
        return {
          subject: `✅ Rendez-vous confirmé – Dr. ${appointment.doctor.lastName}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e0e0e0;border-radius:10px;">
              <h1 style="color:#2563eb;text-align:center;">🏥 Carnet Santé</h1>
              <div style="background:#d1fae5;padding:15px;border-radius:8px;margin:20px 0;">
                <p style="color:#047857;font-weight:bold;text-align:center;">✅ Votre rendez-vous a été confirmé</p>
              </div>
              <p><strong>Médecin :</strong> Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}</p>
              <p><strong>Date :</strong> ${formattedDate}</p>
              <p><strong>Heure :</strong> ${formattedTime}</p>
              <p><strong>Motif :</strong> ${appointment.reason || 'Non spécifié'}</p>
              ${appointment.type === 'teleconsultation'
                ? `<p><strong>Lien :</strong> <a href="${appointment.meetingLink}">${appointment.meetingLink}</a></p>`
                : ''}
            </div>`,
          text: `Rendez-vous confirmé avec Dr. ${appointment.doctor.lastName} le ${formattedDate} à ${formattedTime}`
        };
      },

      appointmentReminder: (appointment, hoursBefore) => {
        const date          = new Date(appointment.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
        const formattedTime = date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
        return {
          subject: `⏰ Rappel : Rendez-vous ${hoursBefore === 24 ? 'demain' : 'dans 1 heure'}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e0e0e0;border-radius:10px;">
              <h1 style="color:#2563eb;text-align:center;">🏥 Carnet Santé</h1>
              <div style="background:#fef9c3;padding:15px;border-radius:8px;margin:20px 0;">
                <p style="color:#854d0e;font-weight:bold;text-align:center;">⏰ Rappel : ${hoursBefore === 24 ? 'demain' : 'dans 1 heure'}</p>
              </div>
              <p><strong>Médecin :</strong> Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}</p>
              <p><strong>Date :</strong> ${formattedDate}</p>
              <p><strong>Heure :</strong> ${formattedTime}</p>
            </div>`,
          text: `Rappel : RDV avec Dr. ${appointment.doctor.lastName} le ${formattedDate} à ${formattedTime}`
        };
      },

      appointmentCancellation: (appointment) => {
        const date          = new Date(appointment.appointmentDate);
        const formattedDate = date.toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
        const formattedTime = date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
        return {
          subject: `❌ Rendez-vous annulé – Dr. ${appointment.doctor.lastName}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e0e0e0;border-radius:10px;">
              <h1 style="color:#2563eb;text-align:center;">🏥 Carnet Santé</h1>
              <div style="background:#fee2e2;padding:15px;border-radius:8px;margin:20px 0;">
                <p style="color:#b91c1c;font-weight:bold;text-align:center;">❌ Rendez-vous annulé</p>
              </div>
              <p><strong>Médecin :</strong> Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}</p>
              <p><strong>Date :</strong> ${formattedDate}</p>
              <p><strong>Heure :</strong> ${formattedTime}</p>
              ${appointment.cancellationReason ? `<p><strong>Raison :</strong> ${appointment.cancellationReason}</p>` : ''}
            </div>`,
          text: `Rendez-vous avec Dr. ${appointment.doctor.lastName} du ${formattedDate} à ${formattedTime} a été annulé.`
        };
      }
    };
  }

  async sendTemplate(type, data, to) {
    console.log(`📧 Template "${type}" → ${to}`);
    const templates = this.getTemplates();
    const template  = templates[type]?.(data);
    if (!template) throw new Error(`Template email "${type}" introuvable`);
    return this.sendEmail({ to, subject: template.subject, html: template.html, text: template.text });
  }
}

module.exports = new EmailService();
