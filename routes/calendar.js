const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// ✅ NE PAS UTILISER sequelize.define ICI - Le modèle doit être dans models/index.js
// ✅ Importer le modèle depuis models/index.js
const { Calendar } = require('../models');

// Middleware pour vérifier que l'utilisateur est un médecin
const isDoctor = (req, res, next) => {
  if (req.user.role !== 'doctor') {
    return res.status(403).json({
      success: false,
      message: 'Accès non autorisé pour votre rôle'
    });
  }
  next();
};

// Middleware pour vérifier que l'utilisateur est un administrateur
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Accès non autorisé pour votre rôle'
    });
  }
  next();
};

// ============================================
// ✅ ROUTES PUBLIQUES (sans authentification)
// ============================================

/**
 * ✅ Récupérer les créneaux disponibles d'un médecin
 * GET /api/calendars/available-slots/:doctorId?date=YYYY-MM-DD
 */
router.get('/available-slots/:doctorId', async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    console.log(`📅 Récupération créneaux pour médecin ${doctorId} date ${date}`);

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date requise (format: YYYY-MM-DD)'
      });
    }

    // 1. Chercher le calendrier du médecin pour cette date
    let calendar = await Calendar.findOne({
      where: {
        doctorId,
        date: date
      }
    });

    // 2. Si aucun calendrier n'existe, en créer un avec des créneaux par défaut
    if (!calendar) {
      const defaultSlots = [
        '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
        '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
        '16:00', '16:30', '17:00'
      ];
      
      calendar = await Calendar.create({
        doctorId,
        date,
        slots: defaultSlots,
        confirmed: false,
        versions: []
      });
      
      console.log(`✅ Calendrier créé automatiquement pour ${doctorId} le ${date}`);
    }

    // 3. Récupérer les rendez-vous déjà réservés
    const { Appointment } = sequelize.models;
    const { Op } = require('sequelize');
    
    const bookedAppointments = await Appointment.findAll({
      where: {
        doctorId,
        status: { [Op.notIn]: ['cancelled', 'completed'] },
        [Op.and]: sequelize.where(
          sequelize.fn('DATE', sequelize.col('appointmentDate')),
          '=',
          date
        )
      }
    });

    // 4. Extraire les heures réservées
    const bookedSlots = bookedAppointments.map(apt => {
      const d = new Date(apt.appointmentDate);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    });

    // 5. Filtrer les créneaux disponibles
    const availableSlots = calendar.slots.filter(slot => !bookedSlots.includes(slot));

    res.json({
      success: true,
      data: {
        availableSlots,
        bookedSlots,
        total: availableSlots.length,
        date,
        doctorId
      }
    });

  } catch (error) {
    console.error('❌ Erreur available-slots:', error);
    
    // En cas d'erreur, retourner des créneaux par défaut
    const defaultSlots = [
      '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'
    ];
    
    res.json({
      success: true,
      data: {
        availableSlots: defaultSlots,
        bookedSlots: [],
        total: defaultSlots.length,
        date: req.query.date,
        doctorId: req.params.doctorId
      }
    });
  }
});

// ============================================
// ✅ ROUTES PROTÉGÉES (authentification requise)
// ============================================
router.use(authenticateToken);

/**
 * ✅ Récupérer les calendriers du médecin connecté
 */
router.get('/', isDoctor, async (req, res, next) => {
  try {
    const calendars = await Calendar.findAll({ 
      where: { doctorId: req.user.id },
      order: [['date', 'ASC']]
    });
    res.json({ success: true, data: calendars });
  } catch (error) {
    logger.error('Erreur lors de la récupération des calendriers:', error);
    next(error);
  }
});

/**
 * ✅ Récupérer tous les calendriers (administrateur)
 */
router.get('/all', isAdmin, async (req, res, next) => {
  try {
    const calendars = await Calendar.findAll({
      include: [{ model: sequelize.models.User, attributes: ['firstName', 'lastName'] }],
      order: [['date', 'DESC']]
    });
    res.json({ success: true, data: calendars });
  } catch (error) {
    logger.error('Erreur lors de la récupération de tous les calendriers:', error);
    next(error);
  }
});

/**
 * ✅ Récupérer les calendriers pour un patient
 */
router.get('/patient/:patientId', async (req, res, next) => {
  try {
    const appointments = await sequelize.models.Appointment.findAll({
      where: { patientId: req.params.patientId },
      attributes: ['doctorId'],
    });
    const doctorIds = appointments.map((appt) => appt.doctorId);
    const calendars = await Calendar.findAll({
      where: { doctorId: doctorIds },
      include: [{ model: sequelize.models.User, attributes: ['firstName', 'lastName'] }],
    });
    res.json({ success: true, data: calendars });
  } catch (error) {
    logger.error('Erreur lors de la récupération des calendriers du patient:', error);
    next(error);
  }
});

/**
 * ✅ Créer ou mettre à jour les disponibilités d'un médecin
 */
router.post('/availability', isDoctor, async (req, res) => {
  try {
    const { date, slots } = req.body;
    const doctorId = req.user.id;

    if (!date || !slots || !Array.isArray(slots)) {
      return res.status(400).json({
        success: false,
        message: 'Date et slots requis'
      });
    }

    const [calendar, created] = await Calendar.findOrCreate({
      where: { doctorId, date },
      defaults: {
        doctorId,
        date,
        slots,
        confirmed: false,
        versions: []
      }
    });

    if (!created) {
      await calendar.update({ slots });
    }

    res.json({
      success: true,
      data: calendar,
      message: created ? 'Disponibilités créées' : 'Disponibilités mises à jour'
    });

  } catch (error) {
    console.error('❌ Erreur update availability:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

/**
 * ✅ Seed automatique des disponibilités (admin uniquement)
 */
router.post('/seed-availabilities', isAdmin, async (req, res) => {
  try {
    const { User } = sequelize.models;
    const { Op } = require('sequelize');

    const doctors = await User.findAll({
      where: { 
        role: 'doctor',
        isActive: true 
      }
    });

    const dates = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      if (date.getDay() !== 0) {
        dates.push(date.toISOString().split('T')[0]);
      }
    }

    const defaultSlots = [
      '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
      '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
      '16:00', '16:30', '17:00'
    ];

    let created = 0;

    for (const doctor of doctors) {
      for (const date of dates) {
        const [calendar, wasCreated] = await Calendar.findOrCreate({
          where: { doctorId: doctor.id, date },
          defaults: {
            doctorId: doctor.id,
            date,
            slots: defaultSlots,
            confirmed: false,
            versions: []
          }
        });
        if (wasCreated) created++;
      }
    }

    res.json({
      success: true,
      message: `✅ ${created} disponibilités créées pour ${doctors.length} médecins`
    });

  } catch (error) {
    console.error('❌ Erreur seed:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du seed'
    });
  }
});

/**
 * ✅ Créer un calendrier
 */
router.post('/', isDoctor, async (req, res, next) => {
  try {
    const { date, slots } = req.body;
    if (!date || !slots || !Array.isArray(slots)) {
      return res.status(400).json({ success: false, message: 'Données invalides' });
    }
    
    const existing = await Calendar.findOne({
      where: {
        doctorId: req.user.id,
        date
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Un calendrier existe déjà pour cette date'
      });
    }

    const calendar = await Calendar.create({
      date,
      slots,
      confirmed: false,
      doctorId: req.user.id,
    });
    res.status(201).json({ success: true, data: calendar });
  } catch (error) {
    logger.error('Erreur lors de la création du calendrier:', error);
    next(error);
  }
});

/**
 * ✅ Mettre à jour un calendrier
 */
router.put('/:id', isDoctor, async (req, res, next) => {
  try {
    const calendar = await Calendar.findByPk(req.params.id);
    if (!calendar) {
      return res.status(404).json({ success: false, message: 'Calendrier non trouvé' });
    }
    if (calendar.confirmed) {
      return res.status(403).json({ success: false, message: 'Calendrier confirmé, non modifiable' });
    }
    if (calendar.doctorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }
    const { date, slots } = req.body;
    await calendar.update({ date, slots });
    res.json({ success: true, data: calendar });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour du calendrier:', error);
    next(error);
  }
});

/**
 * ✅ Supprimer un calendrier
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const calendar = await Calendar.findByPk(req.params.id);
    if (!calendar) {
      return res.status(404).json({ success: false, message: 'Calendrier non trouvé' });
    }
    if (req.user.role !== 'admin' && calendar.doctorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }
    await calendar.destroy();
    res.status(204).send();
  } catch (error) {
    logger.error('Erreur lors de la suppression du calendrier:', error);
    next(error);
  }
});

module.exports = router;
