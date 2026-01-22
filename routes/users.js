const express = require('express');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// Middleware de logging
router.use((req, res, next) => {
  logger.info(`[USERS] ${req.method} ${req.url}`, {
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

/**
 * GET /api/users/patients
 * Récupère tous les patients (pour les médecins)
 */
router.get('/patients', authenticate, async (req, res) => {
  try {
    logger.info('[USERS] Récupération de tous les patients', {
      requestedBy: req.user?.id,
      userRole: req.user?.role
    });
    
    // Vérifier que l'utilisateur est un médecin ou admin
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
      logger.warn('[USERS] ⛔ Accès refusé - Pas médecin/admin');
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les médecins et administrateurs peuvent voir la liste des patients.'
      });
    }

    const patients = await User.findAll({
      where: { 
        role: 'patient',
        isActive: true 
      },
      attributes: [
        'id', 
        'firstName', 
        'lastName', 
        'phoneNumber', 
        'bloodType', 
        'gender', 
        'dateOfBirth',
        'email',
        'createdAt'
      ],
      order: [
        ['lastName', 'ASC'],
        ['firstName', 'ASC']
      ]
    });

    logger.info(`[USERS] ✅ ${patients.length} patients récupérés`);
    
    // ✅ CORRECTION : Retourner dans le format attendu par le frontend
    res.json({
      success: true,
      data: patients,
      count: patients.length
    });
    
  } catch (error) {
    logger.error('[USERS] ❌ Erreur lors de la récupération des patients:', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur lors de la récupération des patients',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/users/doctors
 * Récupère tous les médecins (pour les patients)
 */
router.get('/doctors', authenticate, async (req, res) => {
  try {
    logger.info('[USERS] Récupération de tous les médecins', {
      requestedBy: req.user?.id,
      userRole: req.user?.role
    });

    const doctors = await User.findAll({
      where: { 
        role: 'doctor',
        isActive: true 
      },
      attributes: [
        'id', 
        'firstName', 
        'lastName', 
        'specialty', 
        'isActive', 
        'availability',
        'email', 
        'phoneNumber',
        'bio',
        'licenseNumber',
        'createdAt'
      ],
      order: [
        ['lastName', 'ASC'],
        ['firstName', 'ASC']
      ]
    });

    logger.info(`[USERS] ✅ ${doctors.length} médecins récupérés`);
    
    // ✅ CORRECTION : Retourner dans le format attendu par le frontend
    res.json({
      success: true,
      data: doctors,
      count: doctors.length
    });
    
  } catch (error) {
    logger.error('[USERS] ❌ Erreur lors de la récupération des médecins:', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur lors de la récupération des médecins',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/users/dashboard/stats
 * Récupère les statistiques pour le dashboard
 */
router.get('/dashboard/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    logger.info(`[USERS] Récupération des statistiques dashboard pour ${userRole}`, {
      userId
    });

    let stats = {};

    if (userRole === 'doctor') {
      // Importer le modèle Appointment ici pour éviter les dépendances circulaires
      const { Appointment } = require('../models');
      const { Op } = require('sequelize');
      
      // Statistiques pour un médecin
      const totalAppointments = await Appointment.count({
        where: { doctorId: userId }
      });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayAppointments = await Appointment.count({
        where: {
          doctorId: userId,
          appointmentDate: {
            [Op.between]: [todayStart, todayEnd]
          }
        }
      });

      const totalPatients = await User.count({
        where: { role: 'patient', isActive: true }
      });

      stats = {
        totalAppointments,
        todayAppointments,
        totalPatients,
        monthlyRevenue: 0
      };

    } else if (userRole === 'patient') {
      const { Appointment } = require('../models');
      const { Op } = require('sequelize');
      
      // Statistiques pour un patient
      const totalAppointments = await Appointment.count({
        where: { patientId: userId }
      });

      const upcomingAppointments = await Appointment.count({
        where: {
          patientId: userId,
          appointmentDate: {
            [Op.gte]: new Date()
          },
          status: {
            [Op.in]: ['pending', 'confirmed']
          }
        }
      });

      stats = {
        totalAppointments,
        upcomingAppointments,
        completedAppointments: 0,
        totalDoctors: await User.count({ where: { role: 'doctor', isActive: true } })
      };
    }

    logger.info('[USERS] ✅ Statistiques dashboard récupérées', { stats });

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    logger.error('[USERS] ❌ Erreur lors de la récupération des statistiques:', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/users?role=doctor
 * GET /api/users?role=patient
 * Récupère tous les utilisateurs d'un rôle spécifique (ancienne méthode, gardée pour compatibilité)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { role } = req.query;
    
    logger.info(`[USERS] Récupération des utilisateurs avec rôle: ${role}`, {
      userId: req.user?.id,
      userRole: req.user?.role
    });
    
    // Validation du rôle
    if (!role || !['doctor', 'patient', 'admin'].includes(role)) {
      logger.warn(`[USERS] Rôle invalide ou manquant: ${role}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Rôle invalide. Utilisez "doctor", "patient" ou "admin"' 
      });
    }

    // Vérification des permissions
    if (req.user.role === 'patient' && role !== 'doctor') {
      logger.warn(`[USERS] Patient tentant d'accéder à ${role}`);
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Les patients peuvent uniquement voir les médecins.'
      });
    }

    if (req.user.role === 'doctor' && role !== 'patient') {
      logger.warn(`[USERS] Médecin tentant d'accéder à ${role}`);
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Les médecins peuvent uniquement voir les patients.'
      });
    }

    // Définir les attributs à retourner selon le rôle
    let attributes;
    
    if (role === 'patient') {
      attributes = [
        'id', 
        'firstName', 
        'lastName', 
        'phoneNumber', 
        'bloodType', 
        'gender', 
        'dateOfBirth',
        'email',
        'createdAt'
      ];
    } else if (role === 'doctor') {
      attributes = [
        'id', 
        'firstName', 
        'lastName', 
        'specialty', 
        'isActive', 
        'availability',
        'email', 
        'phoneNumber',
        'bio',
        'licenseNumber',
        'createdAt'
      ];
    } else {
      attributes = [
        'id',
        'firstName',
        'lastName',
        'email',
        'role',
        'isActive',
        'createdAt'
      ];
    }

    const users = await User.findAll({
      where: { 
        role,
        ...(role === 'doctor' ? { isActive: true } : {})
      },
      attributes,
      order: [
        ['lastName', 'ASC'],
        ['firstName', 'ASC']
      ]
    });

    logger.info(`[USERS] ✅ ${users.length} utilisateurs (${role}) récupérés`);
    
    // ✅ CORRECTION : Retourner dans le format standard
    res.json({
      success: true,
      data: users,
      count: users.length
    });
    
  } catch (error) {
    logger.error(`[USERS] ❌ Erreur lors de la récupération des utilisateurs:`, {
      error: error.message,
      stack: error.stack,
      role: req.query.role
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur lors de la récupération des utilisateurs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/users/:id
 * Récupère un utilisateur par son ID
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info(`[USERS] Récupération de l'utilisateur ID: ${id}`, {
      requestedBy: req.user?.id
    });

    const user = await User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      logger.warn(`[USERS] ❌ Utilisateur non trouvé - ID: ${id}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    // Vérification des permissions
    if (req.user.role !== 'admin' && 
        req.user.id !== id && 
        !(req.user.role === 'doctor' && user.role === 'patient') &&
        !(req.user.role === 'patient' && user.role === 'doctor')) {
      logger.warn(`[USERS] ⛔ Accès non autorisé`, {
        requestedBy: req.user.id,
        requestedUser: id
      });
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    logger.info(`[USERS] ✅ Utilisateur récupéré: ${id}`);
    
    res.json({ 
      success: true, 
      data: user 
    });
    
  } catch (error) {
    logger.error(`[USERS] ❌ Erreur lors de la récupération de l'utilisateur:`, {
      error: error.message,
      userId: req.params.id
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/users/:id
 * Met à jour un utilisateur
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    logger.info(`[USERS] Mise à jour de l'utilisateur ID: ${id}`, {
      data: updateData,
      requestedBy: req.user?.id
    });

    const user = await User.findByPk(id);
    
    if (!user) {
      logger.warn(`[USERS] ❌ Utilisateur non trouvé - ID: ${id}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    // Vérification des permissions
    if (req.user.role !== 'admin' && req.user.id !== id) {
      logger.warn(`[USERS] ⛔ Accès non autorisé pour mise à jour`);
      return res.status(403).json({ 
        success: false, 
        message: 'Accès non autorisé' 
      });
    }

    const allowedFields = req.user.role === 'admin' 
      ? Object.keys(updateData)
      : ['firstName', 'lastName', 'phoneNumber', 'bloodType', 'gender', 
         'dateOfBirth', 'specialty', 'isActive', 'availability', 'bio', 'address',
         'city', 'postalCode', 'country', 'profilePicture'];

    const filteredData = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });

    await user.update(filteredData);
    
    logger.info(`[USERS] ✅ Utilisateur mis à jour: ${id}`);
    
    res.json({ 
      success: true, 
      data: user,
      message: 'Utilisateur mis à jour avec succès'
    });
    
  } catch (error) {
    logger.error(`[USERS] ❌ Erreur mise à jour:`, {
      error: error.message,
      userId: req.params.id
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PATCH /api/users/:id/toggle-active
 * Active/désactive un utilisateur
 */
router.patch('/:id/toggle-active', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info(`[USERS] Toggle active pour ID: ${id}`);

    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Accès non autorisé' 
      });
    }

    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    await user.update({ isActive: !user.isActive });
    
    logger.info(`[USERS] ✅ Statut modifié: ${user.isActive}`);
    
    res.json({ 
      success: true, 
      data: user,
      message: `Utilisateur ${user.isActive ? 'activé' : 'désactivé'}`
    });
    
  } catch (error) {
    logger.error('[USERS] ❌ Erreur toggle:', error.message);
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
