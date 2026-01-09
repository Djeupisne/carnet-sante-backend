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
 * GET /api/users?role=doctor
 * GET /api/users?role=patient
 * Récupère tous les utilisateurs d'un rôle spécifique
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
    // Les patients peuvent voir les médecins
    // Les médecins peuvent voir les patients
    // Les admins peuvent tout voir
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

    // Récupérer les utilisateurs
    const users = await User.findAll({
      where: { 
        role,
        ...(role === 'doctor' ? { isActive: true } : {}) // Seulement les médecins actifs
      },
      attributes,
      order: [
        ['lastName', 'ASC'],
        ['firstName', 'ASC']
      ]
    });

    logger.info(`[USERS] ✅ ${users.length} utilisateurs (${role}) récupérés`);
    
    // Retourner directement le tableau pour compatibilité avec le frontend
    res.json(users);
    
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
    // Un utilisateur peut voir son propre profil
    // Un médecin peut voir ses patients
    // Un admin peut tout voir
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
 * Met à jour un utilisateur (disponibilité, statut, etc.)
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    logger.info(`[USERS] Mise à jour de l'utilisateur ID: ${id}`, {
      data: updateData,
      requestedBy: req.user?.id
    });

    // Vérifier que l'utilisateur existe
    const user = await User.findByPk(id);
    
    if (!user) {
      logger.warn(`[USERS] ❌ Utilisateur non trouvé - ID: ${id}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    // Vérification des permissions
    // Un utilisateur peut mettre à jour son propre profil
    // Un admin peut tout mettre à jour
    if (req.user.role !== 'admin' && req.user.id !== id) {
      logger.warn(`[USERS] ⛔ Accès non autorisé pour mise à jour`, {
        requestedBy: req.user.id,
        targetUser: id
      });
      return res.status(403).json({ 
        success: false, 
        message: 'Accès non autorisé. Vous ne pouvez modifier que votre propre profil.' 
      });
    }

    // Liste des champs modifiables selon le rôle
    const allowedFields = req.user.role === 'admin' 
      ? Object.keys(updateData) // Admin peut tout modifier
      : ['firstName', 'lastName', 'phoneNumber', 'bloodType', 'gender', 
         'dateOfBirth', 'specialty', 'isActive', 'availability', 'bio', 'address',
         'city', 'postalCode', 'country', 'profilePicture'];

    // Filtrer les données à mettre à jour
    const filteredData = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });

    // Mettre à jour l'utilisateur
    await user.update(filteredData);
    
    logger.info(`[USERS] ✅ Utilisateur mis à jour: ${id}`, {
      updatedFields: Object.keys(filteredData)
    });
    
    res.json({ 
      success: true, 
      data: user,
      message: 'Utilisateur mis à jour avec succès'
    });
    
  } catch (error) {
    logger.error(`[USERS] ❌ Erreur lors de la mise à jour de l'utilisateur:`, {
      error: error.message,
      stack: error.stack,
      userId: req.params.id
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur lors de la mise à jour',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PATCH /api/users/:id/toggle-active
 * Active/désactive un utilisateur (admin ou self)
 */
router.patch('/:id/toggle-active', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info(`[USERS] Toggle active pour utilisateur ID: ${id}`, {
      requestedBy: req.user?.id
    });

    // Vérification des permissions
    if (req.user.role !== 'admin' && req.user.id !== id) {
      logger.warn(`[USERS] ⛔ Accès non autorisé pour toggle active`);
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

    // Toggle le statut
    await user.update({ isActive: !user.isActive });
    
    logger.info(`[USERS] ✅ Statut actif modifié: ${id} -> ${user.isActive}`);
    
    res.json({ 
      success: true, 
      data: user,
      message: `Utilisateur ${user.isActive ? 'activé' : 'désactivé'} avec succès`
    });
    
  } catch (error) {
    logger.error(`[USERS] ❌ Erreur toggle active:`, {
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
 * GET /api/users/doctors/specialties
 * Récupère la liste des spécialités disponibles
 */
router.get('/doctors/specialties', authenticate, async (req, res) => {
  try {
    logger.info('[USERS] Récupération des spécialités médicales');

    const specialties = await User.findAll({
      where: { 
        role: 'doctor',
        specialty: { [require('sequelize').Op.ne]: null }
      },
      attributes: ['specialty'],
      group: ['specialty'],
      raw: true
    });

    const specialtyList = specialties
      .map(s => s.specialty)
      .filter(Boolean)
      .sort();

    logger.info(`[USERS] ✅ ${specialtyList.length} spécialités trouvées`);
    
    res.json({ 
      success: true, 
      data: specialtyList 
    });
    
  } catch (error) {
    logger.error('[USERS] ❌ Erreur récupération spécialités:', {
      error: error.message
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
