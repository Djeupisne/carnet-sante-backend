const express = require('express');
const router = express.Router();

// Importer toutes les routes
const authRoutes = require('./auth');
const profileRoutes = require('./profile');
const medicalFileRoutes = require('./medicalFile');
const appointmentRoutes = require('./appointment');
const paymentRoutes = require('./payment');
const adminRoutes = require('./admin');
const searchRoutes = require('./search');

// Utiliser les routes
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/medical-files', medicalFileRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/search', searchRoutes);

module.exports = router;