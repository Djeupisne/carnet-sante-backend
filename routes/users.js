const express = require('express');
const User = require('../models/User'); // Ajustez si nécessaire
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware pour vérifier le token JWT
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log(`[${new Date().toISOString()}] Vérification du token pour ${req.url}:`, authHeader || 'Aucun token');
  
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded;
    console.log(`[${new Date().toISOString()}] Token vérifié, utilisateur:`, decoded);
    next();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erreur de vérification du token:`, error.message);
    req.user = null;
    next();
  }
};

// Middleware pour logger les requêtes
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Requête ${req.method} ${req.url} reçue avec query:`, req.query);
  next();
});

/**
 * GET /api/users?role=doctor ou /api/users?role=patient
 * Récupère tous les utilisateurs d'un rôle spécifique
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { role } = req.query;
    console.log(`[${new Date().toISOString()}] Récupération des utilisateurs avec rôle: ${role}`);
    
    // Validation du rôle
    if (!role || !['doctor', 'patient'].includes(role)) {
      console.log(`[${new Date().toISOString()}] Erreur: Rôle invalide ou manquant - ${role}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Rôle invalide. Utilisez "doctor" ou "patient"' 
      });
    }

    console.log(`[${new Date().toISOString()}] Exécution de User.findAll pour rôle: ${role}`);
    
    // Définir les attributs en fonction du rôle
    const attributes = role === 'patient' 
      ? ['id', 'firstName', 'lastName', 'phoneNumber', 'bloodType', 'gender', 'createdAt']
      : ['id', 'firstName', 'lastName', 'specialty', 'isActive', 'availability', 'email', 'phoneNumber', 'createdAt'];

    // Récupérer les utilisateurs
    const users = await User.findAll({
      where: { role },
      attributes,
      order: [
        ['lastName', 'ASC'],
        ['firstName', 'ASC']
      ]
    });

    console.log(`[${new Date().toISOString()}] ✅ ${users.length} utilisateurs (${role}) récupérés`);
    
    // Retourner directement le tableau pour compatibilité avec le frontend
    res.json(users);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Erreur lors de la récupération des utilisateurs (${req.query.role}):`, error.message);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur lors de la récupération des utilisateurs',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * PUT /api/users/:id
 * Met à jour un utilisateur (ex: isActive, availability)
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log(`[${new Date().toISOString()}] Mise à jour de l'utilisateur ID: ${id} avec:`, updateData);

    // Vérifier que l'utilisateur existe
    const user = await User.findByPk(id);
    
    if (!user) {
      console.log(`[${new Date().toISOString()}] ❌ Utilisateur non trouvé - ID: ${id}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    // Vérification des permissions (optionnel)
    if (req.user && req.user.role !== 'admin' && req.user.id !== id) {
      console.log(`[${new Date().toISOString()}] ⛔ Accès non autorisé pour ID: ${id}, utilisateur:`, req.user);
      return res.status(403).json({ 
        success: false, 
        message: 'Accès non autorisé' 
      });
    }

    // Mettre à jour l'utilisateur
    await user.update(updateData);
    
    console.log(`[${new Date().toISOString()}] ✅ Utilisateur mis à jour: ${id}`);
    
    res.json({ 
      success: true, 
      data: user,
      message: 'Utilisateur mis à jour avec succès'
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Erreur lors de la mise à jour de l'utilisateur:`, error.message);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur lors de la mise à jour',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/users/:id
 * Récupère un utilisateur par son ID
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[${new Date().toISOString()}] Récupération de l'utilisateur ID: ${id}`);

    const user = await User.findByPk(id, {
      attributes: { exclude: ['password'] } // Exclure le mot de passe
    });

    if (!user) {
      console.log(`[${new Date().toISOString()}] ❌ Utilisateur non trouvé - ID: ${id}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    console.log(`[${new Date().toISOString()}] ✅ Utilisateur récupéré: ${id}`);
    
    res.json({ 
      success: true, 
      data: user 
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Erreur lors de la récupération de l'utilisateur:`, error.message);
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur',
      error: error.message
    });
  }
});

module.exports = router;
