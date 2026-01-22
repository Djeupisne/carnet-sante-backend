const express = require('express');
const router = express.Router();

// Import des routes
const authRoutes = require('./auth');
const userRoutes = require('./users');
const appointmentRoutes = require('./appointments');
const doctorRoutes = require('./doctors');

// Utilisation des routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/doctors', doctorRoutes);

module.exports = router;
