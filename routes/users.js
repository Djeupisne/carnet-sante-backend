const express = require('express');
const User = require('../models/User'); // Ajustez si nécessaire, par ex. '../models/User'
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware pour vérifier le token JWT (optionnel)
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

// Récupérer les utilisateurs par rôle (doctors ou patients)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { role } = req.query;
    console.log(`[${new Date().toISOString()}] Récupération des utilisateurs avec rôle: ${role}`);
    
    if (!['doctor', 'patient'].includes(role)) {
      console.log(`[${new Date().toISOString()}] Erreur: Rôle invalide - ${role}`);
      return res.status(400).json({ success: false, message: 'Rôle invalide' });
    }

    console.log(`[${new Date().toISOString()}] Exécution de User.findAll pour rôle: ${role}`);
    const attributes = role === 'patient' 
      ? ['id', 'firstName', 'lastName', 'phoneNumber', 'bloodType', 'gender']
      : ['id', 'firstName', 'lastName', 'specialty', 'isActive', 'availability'];
    const users = await User.findAll({
      where: { role },
      attributes,
    });

    console.log(`[${new Date().toISOString()}] Utilisateurs récupérés: ${users.length}`);
    res.json(users);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erreur lors de la récupération des utilisateurs (${req.query.role}):`, error.message, error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur',
      error: error.message,
      stack: error.stack
    });
  }
});

// Mettre à jour un utilisateur (ex: disponibilité)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    console.log(`[${new Date().toISOString()}] Mise à jour de l'utilisateur ID: ${id} avec isActive: ${isActive}`);

    const user = await User.findByPk(id);
    if (!user) {
      console.log(`[${new Date().toISOString()}] Erreur: Utilisateur non trouvé - ID: ${id}`);
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    if (req.user && req.user.role !== 'admin' && req.user.id !== id) {
      console.log(`[${new Date().toISOString()}] Accès non autorisé pour ID: ${id}, utilisateur:`, req.user);
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    await user.update({ isActive });
    console.log(`[${new Date().toISOString()}] Utilisateur mis à jour: ${id}`);
    res.json({ success: true, data: user });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erreur lors de la mise à jour de l'utilisateur:`, error.message, error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur',
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;