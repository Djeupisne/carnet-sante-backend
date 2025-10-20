const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const nodemailer = require('nodemailer');

// Modèle Sequelize pour les calendriers
const { DataTypes } = require('sequelize');
const Calendar = sequelize.define('Calendar', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  date: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  slots: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  confirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  versions: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
});

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

// Récupérer les calendriers d'un médecin
router.get('/', authenticateToken, isDoctor, async (req, res, next) => {
  try {
    const calendars = await Calendar.findAll({ where: { doctorId: req.user.id } });
    res.json({ success: true, data: calendars });
  } catch (error) {
    logger.error('Erreur lors de la récupération des calendriers:', error);
    next(error);
  }
});

// Récupérer tous les calendriers (administrateur)
router.get('/all', authenticateToken, isAdmin, async (req, res, next) => {
  try {
    const calendars = await Calendar.findAll({
      include: [{ model: sequelize.models.User, attributes: ['firstName', 'lastName'] }],
    });
    res.json({ success: true, data: calendars });
  } catch (error) {
    logger.error('Erreur lors de la récupération de tous les calendriers:', error);
    next(error);
  }
});

// Récupérer les calendriers pour un patient
router.get('/patient/:patientId', authenticateToken, async (req, res, next) => {
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

// Créer un calendrier
router.post('/', authenticateToken, isDoctor, async (req, res, next) => {
  try {
    const { date, slots } = req.body;
    if (!date || !slots || !Array.isArray(slots)) {
      return res.status(400).json({ success: false, message: 'Données invalides' });
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

// Mettre à jour un calendrier
router.put('/:id', authenticateToken, isDoctor, async (req, res, next) => {
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

// Supprimer un calendrier
router.delete('/:id', authenticateToken, async (req, res, next) => {
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