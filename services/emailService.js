const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendEmail({ to, subject, html, text }) {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM,
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

      return result;
    } catch (error) {
      logger.error('Erreur lors de l\'envoi de l\'email', {
        to,
        subject,
        error: error.message
      });
      throw error;
    }
  }

  async sendTemplateEmail({ to, subject, template, data }) {
    const html = this.generateTemplate(template, data);
    const text = this.generateTextTemplate(template, data);

    return await this.sendEmail({ to, subject, html, text });
  }

  generateTemplate(template, data) {
    const templates = {
      welcome: `
        <h1>Bienvenue sur Carnet de Santé Virtuel</h1>
        <p>Bonjour ${data.user.firstName},</p>
        <p>Votre compte a été créé avec succès.</p>
        <p>Votre code unique: <strong>${data.user.uniqueCode}</strong></p>
      `,
      passwordReset: `
        <h1>Réinitialisation de mot de passe</h1>
        <p>Cliquez sur le lien pour réinitialiser votre mot de passe:</p>
        <a href="${data.resetLink}">Réinitialiser le mot de passe</a>
      `,
      appointmentConfirmation: `
        <h1>Confirmation de rendez-vous</h1>
        <p>Votre rendez-vous avec le Dr ${data.doctorName} est confirmé.</p>
        <p>Date: ${data.appointmentDate}</p>
        <p>Lieu: ${data.location}</p>
      `
    };

    return templates[template] || '<p>Email template non trouvé</p>';
  }

  generateTextTemplate(template, data) {
    const templates = {
      welcome: `Bienvenue sur Carnet de Santé Virtuel. Votre code unique: ${data.user.uniqueCode}`,
      passwordReset: `Lien de réinitialisation: ${data.resetLink}`,
      appointmentConfirmation: `Rendez-vous confirmé avec le Dr ${data.doctorName} le ${data.appointmentDate}`
    };

    return templates[template] || 'Email template non trouvé';
  }
}

module.exports = new EmailService();