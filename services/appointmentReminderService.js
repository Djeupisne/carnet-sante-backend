// services/appointmentReminderService.js
// Service de rappel automatique par Email et SMS pour les rendez-vous

const nodemailer = require('nodemailer');
const { Appointment, User } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../utils/logger');

/**
 * Configuration des délais de rappel
 * Vous pouvez ajuster ces valeurs selon vos besoins
 */
const REMINDER_SCHEDULES = {
  // Rappel 24 heures avant
  ONE_DAY_BEFORE: {
    hours: 24,
    label: '24 heures avant'
  },
  // Rappel 3 heures avant
  THREE_HOURS_BEFORE: {
    hours: 3,
    label: '3 heures avant'
  },
  // Rappel 1 heure avant
  ONE_HOUR_BEFORE: {
    hours: 1,
    label: '1 heure avant'
  }
};

/**
 * Créer un transporteur email
 */
function createEmailTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Configuration email manquante - Les emails ne seront pas envoyés');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

/**
 * Envoyer un email de rappel
 */
async function sendEmailReminder(appointment, user, doctor, reminderType) {
  const transporter = createEmailTransporter();
  if (!transporter) {
    console.log('⏭️ Email non envoyé - Configuration manquante');
    return { sent: false, reason: 'Configuration manquante' };
  }

  try {
    const appointmentDate = new Date(appointment.startTime);
    const formattedDate = appointmentDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = appointmentDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Template email patient
    const patientEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .appointment-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #4CAF50; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #555; }
          .button { display: inline-block; padding: 12px 30px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Rappel de Rendez-vous</h1>
          </div>
          <div class="content">
            <p>Bonjour ${user.firstName} ${user.lastName},</p>
            
            <p>Nous vous rappelons que vous avez un rendez-vous <strong>${REMINDER_SCHEDULES[reminderType]?.label || 'bientôt'}</strong>.</p>
            
            <div class="appointment-box">
              <h2 style="margin-top: 0; color: #4CAF50;">📅 Détails du Rendez-vous</h2>
              
              <div class="info-row">
                <span class="label">👨‍⚕️ Médecin :</span> Dr. ${doctor.firstName} ${doctor.lastName}
              </div>
              
              <div class="info-row">
                <span class="label">🏥 Spécialité :</span> ${doctor.specialty || 'Médecine générale'}
              </div>
              
              <div class="info-row">
                <span class="label">📅 Date :</span> ${formattedDate}
              </div>
              
              <div class="info-row">
                <span class="label">⏰ Heure :</span> ${formattedTime}
              </div>
              
              ${appointment.location ? `
                <div class="info-row">
                  <span class="label">📍 Lieu :</span> ${appointment.location}
                </div>
              ` : ''}
              
              ${appointment.notes ? `
                <div class="info-row">
                  <span class="label">📝 Notes :</span> ${appointment.notes}
                </div>
              ` : ''}
            </div>
            
            <p><strong>⚠️ Pensez à :</strong></p>
            <ul>
              <li>Arriver 10 minutes avant l'heure du rendez-vous</li>
              <li>Apporter votre carte vitale et votre carte de mutuelle</li>
              <li>Apporter vos anciens examens médicaux si nécessaire</li>
            </ul>
            
            <p>Si vous devez annuler ou reporter ce rendez-vous, merci de nous contacter le plus tôt possible.</p>
            
            <a href="${process.env.FRONTEND_URL}/appointments" class="button">Voir mes rendez-vous</a>
            
            <div class="footer">
              <p>Cet email est un rappel automatique.</p>
              <p>Carnet de Santé - Votre santé, notre priorité 💚</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Template email docteur
    const doctorEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .appointment-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #2196F3; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #555; }
          .button { display: inline-block; padding: 12px 30px; background: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Rappel de Consultation</h1>
          </div>
          <div class="content">
            <p>Bonjour Dr. ${doctor.firstName} ${doctor.lastName},</p>
            
            <p>Vous avez une consultation prévue <strong>${REMINDER_SCHEDULES[reminderType]?.label || 'bientôt'}</strong>.</p>
            
            <div class="appointment-box">
              <h2 style="margin-top: 0; color: #2196F3;">📋 Informations Patient</h2>
              
              <div class="info-row">
                <span class="label">👤 Patient :</span> ${user.firstName} ${user.lastName}
              </div>
              
              <div class="info-row">
                <span class="label">📧 Email :</span> ${user.email}
              </div>
              
              ${user.phoneNumber ? `
                <div class="info-row">
                  <span class="label">📱 Téléphone :</span> ${user.phoneNumber}
                </div>
              ` : ''}
              
              ${user.bloodType ? `
                <div class="info-row">
                  <span class="label">🩸 Groupe sanguin :</span> ${user.bloodType}
                </div>
              ` : ''}
              
              <div class="info-row">
                <span class="label">📅 Date :</span> ${formattedDate}
              </div>
              
              <div class="info-row">
                <span class="label">⏰ Heure :</span> ${formattedTime}
              </div>
              
              ${appointment.reason ? `
                <div class="info-row">
                  <span class="label">🎯 Motif :</span> ${appointment.reason}
                </div>
              ` : ''}
              
              ${appointment.notes ? `
                <div class="info-row">
                  <span class="label">📝 Notes :</span> ${appointment.notes}
                </div>
              ` : ''}
            </div>
            
            <a href="${process.env.FRONTEND_URL}/doctor/appointments" class="button">Voir mes consultations</a>
            
            <div class="footer">
              <p>Cet email est un rappel automatique.</p>
              <p>Carnet de Santé - Plateforme professionnelle 💼</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Envoyer email au patient
    await transporter.sendMail({
      from: `"Carnet de Santé" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `🔔 Rappel : Rendez-vous ${formattedDate} à ${formattedTime}`,
      html: patientEmailHtml
    });

    console.log(`✅ Email envoyé au patient: ${user.email}`);

    // Envoyer email au docteur
    await transporter.sendMail({
      from: `"Carnet de Santé" <${process.env.EMAIL_USER}>`,
      to: doctor.email,
      subject: `🔔 Rappel : Consultation avec ${user.firstName} ${user.lastName} - ${formattedDate} à ${formattedTime}`,
      html: doctorEmailHtml
    });

    console.log(`✅ Email envoyé au docteur: ${doctor.email}`);

    return { sent: true, method: 'email' };

  } catch (error) {
    console.error('❌ Erreur envoi email:', error.message);
    logger.error('Erreur envoi email de rappel', {
      appointmentId: appointment.id,
      error: error.message
    });
    return { sent: false, error: error.message };
  }
}

/**
 * Envoyer un SMS de rappel (Twilio)
 */
async function sendSMSReminder(appointment, user, doctor, reminderType) {
  // Vérifier la configuration Twilio
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.log('⏭️ SMS non envoyé - Configuration Twilio manquante');
    return { sent: false, reason: 'Configuration Twilio manquante' };
  }

  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const appointmentDate = new Date(appointment.startTime);
    const formattedDate = appointmentDate.toLocaleDateString('fr-FR');
    const formattedTime = appointmentDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // SMS au patient
    if (user.phoneNumber) {
      const patientMessage = `🔔 Rappel Rendez-vous\n\nBonjour ${user.firstName},\n\nVous avez RDV avec Dr. ${doctor.firstName} ${doctor.lastName}\n📅 ${formattedDate} à ${formattedTime}\n\nCarnet de Santé`;

      await client.messages.create({
        body: patientMessage,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: user.phoneNumber
      });

      console.log(`✅ SMS envoyé au patient: ${user.phoneNumber}`);
    }

    // SMS au docteur
    if (doctor.phoneNumber) {
      const doctorMessage = `🔔 Rappel Consultation\n\nDr. ${doctor.firstName},\n\nConsultation avec ${user.firstName} ${user.lastName}\n📅 ${formattedDate} à ${formattedTime}\n\nCarnet de Santé`;

      await client.messages.create({
        body: doctorMessage,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: doctor.phoneNumber
      });

      console.log(`✅ SMS envoyé au docteur: ${doctor.phoneNumber}`);
    }

    return { sent: true, method: 'sms' };

  } catch (error) {
    console.error('❌ Erreur envoi SMS:', error.message);
    logger.error('Erreur envoi SMS de rappel', {
      appointmentId: appointment.id,
      error: error.message
    });
    return { sent: false, error: error.message };
  }
}

/**
 * Fonction principale : Envoyer les rappels
 */
async function sendReminders(reminderType = 'ONE_DAY_BEFORE') {
  try {
    console.log(`\n🔔 === ENVOI DES RAPPELS ${reminderType} ===`);
    
    const schedule = REMINDER_SCHEDULES[reminderType];
    if (!schedule) {
      console.error('❌ Type de rappel invalide:', reminderType);
      return { success: false, error: 'Type de rappel invalide' };
    }

    // Calculer la fenêtre de temps
    const now = new Date();
    const targetTime = new Date(now.getTime() + schedule.hours * 60 * 60 * 1000);
    
    // Fenêtre de +/- 30 minutes autour de l'heure cible
    const windowStart = new Date(targetTime.getTime() - 30 * 60 * 1000);
    const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);

    console.log(`📅 Recherche des RDV entre ${windowStart.toLocaleString('fr-FR')} et ${windowEnd.toLocaleString('fr-FR')}`);

    // Trouver les rendez-vous dans cette fenêtre
    const appointments = await Appointment.findAll({
      where: {
        startTime: {
          [Op.between]: [windowStart, windowEnd]
        },
        status: {
          [Op.in]: ['scheduled', 'confirmed'] // Seulement les RDV confirmés
        }
      },
      include: [
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'email', 'firstName', 'lastName', 'phoneNumber', 'bloodType']
        },
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'email', 'firstName', 'lastName', 'phoneNumber', 'specialty']
        }
      ]
    });

    console.log(`📋 ${appointments.length} rendez-vous trouvés`);

    if (appointments.length === 0) {
      console.log('✅ Aucun rappel à envoyer');
      return { success: true, sent: 0, appointments: [] };
    }

    const results = [];

    // Envoyer les rappels
    for (const appointment of appointments) {
      console.log(`\n📤 Traitement RDV ${appointment.id}...`);

      const emailResult = await sendEmailReminder(
        appointment,
        appointment.patient,
        appointment.doctor,
        reminderType
      );

      const smsResult = await sendSMSReminder(
        appointment,
        appointment.patient,
        appointment.doctor,
        reminderType
      );

      // Mettre à jour l'appointment pour marquer que le rappel a été envoyé
      await appointment.update({
        reminderSent: true,
        reminderSentAt: new Date()
      });

      results.push({
        appointmentId: appointment.id,
        patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        doctorName: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
        appointmentTime: appointment.startTime,
        emailSent: emailResult.sent,
        smsSent: smsResult.sent
      });
    }

    console.log(`\n✅ === RAPPELS ENVOYÉS: ${results.length} ===\n`);

    logger.info('Rappels envoyés', {
      reminderType,
      appointmentsProcessed: appointments.length,
      results
    });

    return {
      success: true,
      sent: results.length,
      appointments: results
    };

  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi des rappels:', error);
    logger.error('Erreur envoi rappels', {
      reminderType,
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendReminders,
  REMINDER_SCHEDULES
};
