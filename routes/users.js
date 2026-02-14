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

    // Si c'est un médecin, ne récupérer que ses patients (via les rendez-vous)
    if (req.user.role === 'doctor') {
      const { Appointment } = require('../models');
      const { Op } = require('sequelize');
      
      // Récupérer tous les IDs des patients qui ont eu des rendez-vous avec ce médecin
      const appointments = await Appointment.findAll({
        where: { 
          doctorId: req.user.id,
          status: {
            [Op.in]: ['confirmed', 'completed', 'pending']
          }
        },
        attributes: ['patientId'],
        group: ['patientId']
      });
      
      const patientIds = appointments.map(apt => apt.patientId);
      
      const patients = await User.findAll({
        where: { 
          id: { [Op.in]: patientIds },
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

      logger.info(`[USERS] ✅ ${patients.length} patients récupérés pour le médecin ${req.user.id}`);
      
      return res.json({
        success: true,
        data: patients,
        count: patients.length
      });
    }

    // Si c'est un admin, voir tous les patients
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

    // Si c'est un patient, ne récupérer que les médecins qu'il a consultés
    if (req.user.role === 'patient') {
      const { Appointment } = require('../models');
      const { Op } = require('sequelize');
      
      const appointments = await Appointment.findAll({
        where: { 
          patientId: req.user.id,
          status: {
            [Op.in]: ['confirmed', 'completed', 'pending']
          }
        },
        attributes: ['doctorId'],
        group: ['doctorId']
      });
      
      const doctorIds = appointments.map(apt => apt.doctorId);
      
      const doctors = await User.findAll({
        where: { 
          id: { [Op.in]: doctorIds },
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

      logger.info(`[USERS] ✅ ${doctors.length} médecins récupérés pour le patient ${req.user.id}`);
      
      return res.json({
        success: true,
        data: doctors,
        count: doctors.length
      });
    }

    // Sinon, voir tous les médecins (pour admin)
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

      // Compter les patients uniques de ce médecin
      const uniquePatients = await Appointment.findAll({
        where: { doctorId: userId },
        attributes: ['patientId'],
        group: ['patientId']
      });

      const totalPatients = uniquePatients.length;

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

      // Compter les médecins uniques de ce patient
      const uniqueDoctors = await Appointment.findAll({
        where: { patientId: userId },
        attributes: ['doctorId'],
        group: ['doctorId']
      });

      stats = {
        totalAppointments,
        upcomingAppointments,
        completedAppointments: 0,
        totalDoctors: uniqueDoctors.length
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
    let whereClause = { role };
    
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
      
      // Si c'est un médecin qui demande, ne montrer que SES patients
      if (req.user.role === 'doctor') {
        const { Appointment } = require('../models');
        const { Op } = require('sequelize');
        
        const appointments = await Appointment.findAll({
          where: { 
            doctorId: req.user.id,
            status: {
              [Op.in]: ['confirmed', 'completed', 'pending']
            }
          },
          attributes: ['patientId'],
          group: ['patientId']
        });
        
        const patientIds = appointments.map(apt => apt.patientId);
        whereClause.id = { [Op.in]: patientIds };
      }
      
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
      
      // Si c'est un patient qui demande, ne montrer que SES médecins
      if (req.user.role === 'patient') {
        const { Appointment } = require('../models');
        const { Op } = require('sequelize');
        
        const appointments = await Appointment.findAll({
          where: { 
            patientId: req.user.id,
            status: {
              [Op.in]: ['confirmed', 'completed', 'pending']
            }
          },
          attributes: ['doctorId'],
          group: ['doctorId']
        });
        
        const doctorIds = appointments.map(apt => apt.doctorId);
        whereClause.id = { [Op.in]: doctorIds };
      }
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
      where: whereClause,
      attributes,
      order: [
        ['lastName', 'ASC'],
        ['firstName', 'ASC']
      ]
    });

    logger.info(`[USERS] ✅ ${users.length} utilisateurs (${role}) récupérés`);
    
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

    // ✅ PERMISSIONS CORRIGÉES - Les médecins ne voient que leurs patients
    if (req.user.role !== 'admin' && req.user.id !== id) {
      
      // Si c'est un médecin qui veut voir un patient
      if (req.user.role === 'doctor' && user.role === 'patient') {
        // Vérifier si ce patient a déjà eu un rendez-vous avec ce médecin
        const { Appointment } = require('../models');
        const { Op } = require('sequelize');
        
        const hasAppointment = await Appointment.findOne({
          where: {
            doctorId: req.user.id,
            patientId: user.id,
            status: {
              [Op.in]: ['confirmed', 'completed', 'pending']
            }
          }
        });
        
        if (!hasAppointment) {
          logger.warn(`[USERS] ⛔ Médecin ${req.user.id} tente d'accéder à un patient qui n'est pas le sien: ${id}`);
          return res.status(403).json({
            success: false,
            message: 'Ce patient ne fait pas partie de vos patients'
          });
        }
        
        logger.info(`[USERS] ✅ Médecin accède à son patient: ${id}`);
      }
      // Si c'est un patient qui veut voir un médecin
      else if (req.user.role === 'patient' && user.role === 'doctor') {
        const { Appointment } = require('../models');
        
        const hasAppointment = await Appointment.findOne({
          where: {
            doctorId: user.id,
            patientId: req.user.id
          }
        });
        
        if (!hasAppointment) {
          logger.warn(`[USERS] ⛔ Patient tente d'accéder à un médecin sans rendez-vous`);
          return res.status(403).json({
            success: false,
            message: 'Vous n\'avez pas de rendez-vous avec ce médecin'
          });
        }
      }
      // Autres cas non autorisés
      else {
        logger.warn(`[USERS] ⛔ Accès non autorisé`, {
          requestedBy: req.user.id,
          requestedUser: id,
          userRole: req.user.role,
          targetRole: user.role
        });
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }
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
