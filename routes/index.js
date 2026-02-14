const express = require('express');
const router = express.Router();

// Import des routes principales
const authRoutes = require('./auth');
const userRoutes = require('./users');
const appointmentRoutes = require('./appointments');
const doctorRoutes = require('./doctors');
const patientRoutes = require('./patients'); // ✅ NOUVEAU
const calendarRoutes = require('./calendar'); // ✅ Si vous avez des routes pour calendrier
const medicalFileRoutes = require('./medicalFile'); // ✅ Si vous avez des routes pour dossiers médicaux
const paymentRoutes = require('./payment'); // ✅ Si vous avez des routes pour paiements
const notificationRoutes = require('./notifications'); // ✅ Si vous avez des routes pour notifications
const adminRoutes = require('./admin'); // ✅ Routes admin
const searchRoutes = require('./search'); // ✅ Routes de recherche
const reviewRoutes = require('./review'); // ✅ Routes pour les avis

// Utilisation des routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/doctors', doctorRoutes);
router.use('/patients', patientRoutes); // ✅ Ajout des routes patients
router.use('/calendar', calendarRoutes);
router.use('/medical-files', medicalFileRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/search', searchRoutes);
router.use('/reviews', reviewRoutes);

// Route de test pour vérifier que l'API fonctionne
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '🚀 API Carnet de Santé opérationnelle',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/auth',
      '/users',
      '/appointments',
      '/doctors',
      '/patients',
      '/calendar',
      '/medical-files',
      '/payments',
      '/notifications',
      '/admin',
      '/search',
      '/reviews'
    ]
  });
});

module.exports = router;
