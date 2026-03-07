const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const { Calendar, Appointment, User } = require('../models');
const { Op } = require('sequelize');

const isDoctor = (req, res, next) => {
  if (req.user.role !== 'doctor') {
    return res.status(403).json({ success: false, message: 'Accès non autorisé pour votre rôle' });
  }
  next();
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Accès non autorisé pour votre rôle' });
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

    console.log(`📅 Récupération créneaux disponibles pour médecin ${doctorId} date ${date}`);

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date requise (format: YYYY-MM-DD)' });
    }

    let calendar = await Calendar.findOne({ where: { doctorId, date } });

    if (!calendar) {
      const defaultSlots = [
        '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
        '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
        '16:00', '16:30', '17:00'
      ];
      calendar = await Calendar.create({
        doctorId, date, slots: defaultSlots, confirmed: false, versions: []
      });
      console.log(`✅ Calendrier créé automatiquement pour ${doctorId} le ${date}`);
    }

    const bookedAppointments = await Appointment.findAll({
      where: {
        doctorId,
        status: { [Op.notIn]: ['cancelled', 'completed'] },
        [Op.and]: sequelize.where(
          sequelize.fn('DATE', sequelize.col('appointmentDate')), '=', date
        )
      }
    });

    const bookedSlots = bookedAppointments.map(apt => {
      const d = new Date(apt.appointmentDate);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    });

    const availableSlots = calendar.slots.filter(slot => !bookedSlots.includes(slot));

    res.json({
      success: true,
      data: { availableSlots, bookedSlots, total: availableSlots.length, date, doctorId }
    });

  } catch (error) {
    console.error('❌ Erreur available-slots:', error);
    const defaultSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
    res.json({
      success: true,
      data: {
        availableSlots: defaultSlots, bookedSlots: [], total: defaultSlots.length,
        date: req.query.date, doctorId: req.params.doctorId
      }
    });
  }
});

/**
 * ✅ [CORRECTION] Récupérer les créneaux OCCUPÉS d'un médecin
 * GET /api/calendars/booked-slots/:doctorId?date=YYYY-MM-DD
 * 
 * ⚠️ CETTE ROUTE MANQUAIT — C'est la cause du 404 !
 */
router.get('/booked-slots/:doctorId', async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    console.log(`🚫 Récupération créneaux occupés pour médecin ${doctorId} date ${date}`);

    const whereClause = {
      doctorId,
      status: { [Op.in]: ['pending', 'confirmed'] }
    };

    if (date) {
      whereClause[Op.and] = sequelize.where(
        sequelize.fn('DATE', sequelize.col('appointmentDate')), '=', date
      );
    }

    const appointments = await Appointment.findAll({
      where: whereClause,
      attributes: ['id', 'appointmentDate', 'duration', 'status']
    });

    const bookedSlots = appointments.map(apt => {
      const d = new Date(apt.appointmentDate);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    });

    res.json({
      success: true,
      data: { bookedSlots, total: bookedSlots.length, date: date || null, doctorId }
    });

  } catch (error) {
    console.error('❌ Erreur booked-slots:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des créneaux occupés',
      error: error.message
    });
  }
});

// ============================================
// ✅ ROUTES PROTÉGÉES (authentification requise)
// ============================================
router.use(authenticateToken);

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

router.get('/all', isAdmin, async (req, res, next) => {
  try {
    const calendars = await Calendar.findAll({
      include: [{ model: User, as: 'doctor', attributes: ['firstName', 'lastName'] }],
      order: [['date', 'DESC']]
    });
    res.json({ success: true, data: calendars });
  } catch (error) {
    logger.error('Erreur lors de la récupération de tous les calendriers:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des calendriers' });
  }
});

router.get('/patient/:patientId', async (req, res, next) => {
  try {
    const appointments = await Appointment.findAll({
      where: { patientId: req.params.patientId },
      attributes: ['doctorId'],
    });
    const doctorIds = appointments.map((appt) => appt.doctorId);
    const calendars = await Calendar.findAll({
      where: { doctorId: doctorIds },
      include: [{ model: User, as: 'doctor', attributes: ['firstName', 'lastName'] }],
    });
    res.json({ success: true, data: calendars });
  } catch (error) {
    logger.error('Erreur lors de la récupération des calendriers du patient:', error);
    next(error);
  }
});

router.post('/availability', isDoctor, async (req, res) => {
  try {
    const { date, slots } = req.body;
    const doctorId = req.user.id;

    if (!date || !slots || !Array.isArray(slots)) {
      return res.status(400).json({ success: false, message: 'Date et slots requis' });
    }

    const [calendar, created] = await Calendar.findOrCreate({
      where: { doctorId, date },
      defaults: { doctorId, date, slots, confirmed: false, versions: [] }
    });

    if (!created) await calendar.update({ slots });

    res.json({
      success: true, data: calendar,
      message: created ? 'Disponibilités créées' : 'Disponibilités mises à jour'
    });
  } catch (error) {
    console.error('❌ Erreur update availability:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.post('/seed-availabilities', isAdmin, async (req, res) => {
  try {
    const doctors = await User.findAll({ where: { role: 'doctor', isActive: true } });
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      if (date.getDay() !== 0) dates.push(date.toISOString().split('T')[0]);
    }
    const defaultSlots = [
      '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
      '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
      '16:00', '16:30', '17:00'
    ];
    let created = 0;
    for (const doctor of doctors) {
      for (const date of dates) {
        const [, wasCreated] = await Calendar.findOrCreate({
          where: { doctorId: doctor.id, date },
          defaults: { doctorId: doctor.id, date, slots: defaultSlots, confirmed: false, versions: [] }
        });
        if (wasCreated) created++;
      }
    }
    res.json({ success: true, message: `✅ ${created} disponibilités créées pour ${doctors.length} médecins` });
  } catch (error) {
    console.error('❌ Erreur seed:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du seed' });
  }
});

router.post('/', isDoctor, async (req, res, next) => {
  try {
    const { date, slots } = req.body;
    if (!date || !slots || !Array.isArray(slots)) {
      return res.status(400).json({ success: false, message: 'Données invalides' });
    }
    const existing = await Calendar.findOne({ where: { doctorId: req.user.id, date } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Un calendrier existe déjà pour cette date' });
    }
    const calendar = await Calendar.create({ date, slots, confirmed: false, doctorId: req.user.id });
    res.status(201).json({ success: true, data: calendar });
  } catch (error) {
    logger.error('Erreur lors de la création du calendrier:', error);
    next(error);
  }
});

router.put('/:id', isDoctor, async (req, res, next) => {
  try {
    const calendar = await Calendar.findByPk(req.params.id);
    if (!calendar) return res.status(404).json({ success: false, message: 'Calendrier non trouvé' });
    if (calendar.confirmed) return res.status(403).json({ success: false, message: 'Calendrier confirmé, non modifiable' });
    if (calendar.doctorId !== req.user.id) return res.status(403).json({ success: false, message: 'Non autorisé' });
    const { date, slots } = req.body;
    await calendar.update({ date, slots });
    res.json({ success: true, data: calendar });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour du calendrier:', error);
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const calendar = await Calendar.findByPk(req.params.id);
    if (!calendar) return res.status(404).json({ success: false, message: 'Calendrier non trouvé' });
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

router.post('/:id/confirm', isDoctor, async (req, res, next) => {
  try {
    const calendar = await Calendar.findByPk(req.params.id);
    if (!calendar) return res.status(404).json({ success: false, message: 'Calendrier non trouvé' });
    if (calendar.doctorId !== req.user.id) return res.status(403).json({ success: false, message: 'Non autorisé à confirmer ce calendrier' });
    await calendar.update({ confirmed: true });
    await calendar.reload();
    res.json({ success: true, data: calendar, message: 'Calendrier confirmé avec succès' });
  } catch (error) {
    logger.error('Erreur lors de la confirmation du calendrier:', error);
    next(error);
  }
});

router.post('/:id/version', isDoctor, async (req, res, next) => {
  try {
    const calendar = await Calendar.findByPk(req.params.id);
    if (!calendar) return res.status(404).json({ success: false, message: 'Calendrier non trouvé' });
    if (calendar.doctorId !== req.user.id) return res.status(403).json({ success: false, message: 'Non autorisé' });
    const versions = calendar.versions || [];
    versions.push({ date: calendar.date, slots: calendar.slots, confirmed: calendar.confirmed, savedAt: new Date() });
    await calendar.update({ versions });
    res.json({ success: true, message: 'Version sauvegardée', data: calendar });
  } catch (error) {
    logger.error('Erreur lors de la sauvegarde de la version:', error);
    next(error);
  }
});

router.post('/:id/notify', isDoctor, async (req, res, next) => {
  try {
    const calendar = await Calendar.findByPk(req.params.id);
    if (!calendar) return res.status(404).json({ success: false, message: 'Calendrier non trouvé' });
    if (calendar.doctorId !== req.user.id) return res.status(403).json({ success: false, message: 'Non autorisé' });
    res.json({ success: true, message: 'Patients notifiés (fonctionnalité à implémenter)' });
  } catch (error) {
    logger.error('Erreur lors de la notification des patients:', error);
    res.json({ success: true, message: 'Calendrier mis à jour (notification échouée)' });
  }
});

module.exports = router;
