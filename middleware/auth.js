// middleware/auth.js
// Middleware d'authentification avec support admin

const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware d'authentification
 * Vérifie le token JWT et attache les infos utilisateur à req.user
 * Gère les admins (qui n'existent pas en base) ET les utilisateurs normaux
 */
const authMiddleware = async (req, res, next) => {
  try {
    console.log('\n🔐 === AUTH MIDDLEWARE ===');
    console.log('📍 Path:', req.path);
    console.log('📋 Method:', req.method);

    // 1. Récupérer le token
    const authHeader = req.headers.authorization;
    console.log('🔑 Authorization header présent:', !!authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Token manquant ou format invalide');
      return res.status(401).json({
        success: false,
        message: 'Authentification requise - Token manquant'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('✅ Token extrait (longueur:', token.length, ')');

    // 2. Vérifier et décoder le token
    console.log('🔍 Vérification du token JWT...');
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024'
    );

    console.log('✅ Token décodé:', {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      isAdmin: decoded.isAdmin
    });

    // 3. CAS SPÉCIAL : Gérer les admins (qui n'existent pas en base)
    if (decoded.isAdmin === true || decoded.role === 'admin') {
      console.log('👑 Admin détecté dans le token');
      
      req.user = {
        id: decoded.userId,
        email: decoded.email || 'admin@carnetsante.com',
        firstName: decoded.firstName || 'Admin',
        lastName: decoded.lastName || 'User',
        role: 'admin',
        isAdmin: true,
        uniqueCode: 'ADMIN',
        isVerified: true,
        isActive: true,
        profileCompleted: true
      };

      console.log('✅ Admin authentifié:', req.user.email);
      return next();
    }

    // 4. Utilisateur normal : vérifier en base de données
    console.log('👤 Utilisateur normal, recherche en base...');
    console.log('🔍 UserID:', decoded.userId);

    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] }
    });

    if (!user) {
      console.log('❌ Utilisateur non trouvé en base');
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    console.log('✅ Utilisateur trouvé:', user.email, '(Role:', user.role, ')');

    // Vérifier si le compte est actif
    if (!user.isActive) {
      console.log('❌ Compte désactivé');
      return res.status(403).json({
        success: false,
        message: 'Compte désactivé'
      });
    }

    // Attacher l'utilisateur à la requête
    req.user = user;
    console.log('✅ Utilisateur attaché à req.user');
    console.log('🎉 Authentification réussie\n');

    next();

  } catch (error) {
    console.error('\n❌ === ERREUR AUTH MIDDLEWARE ===');
    console.error('Type:', error.name);
    console.error('Message:', error.message);

    // Gestion des erreurs JWT spécifiques
    if (error.name === 'TokenExpiredError') {
      console.error('⏰ Token expiré');
      return res.status(401).json({
        success: false,
        message: 'Token expiré',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      console.error('🔒 Token invalide');
      return res.status(401).json({
        success: false,
        message: 'Token invalide',
        code: 'TOKEN_INVALID'
      });
    }

    console.error('Stack:', error.stack);
    return res.status(401).json({
      success: false,
      message: 'Erreur d\'authentification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware pour vérifier les rôles spécifiques
 * Usage : router.get('/admin-only', authMiddleware, requireRole(['admin']), ...)
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    console.log('\n🔍 === ROLE CHECK ===');
    console.log('Rôle utilisateur:', req.user.role);
    console.log('Rôles autorisés:', allowedRoles);

    if (!req.user) {
      console.log('❌ Aucun utilisateur dans req.user');
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.log('❌ Rôle non autorisé');
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé - Permissions insuffisantes'
      });
    }

    console.log('✅ Rôle autorisé\n');
    next();
  };
};

/**
 * Middleware optionnel pour les routes publiques
 * Attache l'utilisateur si un token valide est présent, sinon continue
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Pas de token, on continue sans utilisateur
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024'
    );

    // Admin
    if (decoded.isAdmin === true || decoded.role === 'admin') {
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: 'admin',
        isAdmin: true
      };
      return next();
    }

    // Utilisateur normal
    const user = await User.findByPk(decoded.userId);
    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    // En cas d'erreur, on continue sans utilisateur (route publique)
    next();
  }
};

module.exports = {
  authMiddleware,
  requireRole,
  optionalAuth
};
