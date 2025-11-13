const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Middleware pour authentifier le token JWT
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification manquant'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024');
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou compte désactivé'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Erreur d\'authentification:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expiré'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur d\'authentification'
    });
  }
};

// Middleware pour autoriser des rôles spécifiques
const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé pour votre rôle'
      });
    }
    next();
  };
};

// Middleware pour authentification optionnelle
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024');
      const user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] }
      });

      if (user && user.isActive) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // En cas d'erreur, continuer sans authentification
    next();
  }
};

module.exports = { authenticateToken, authorizeRole, optionalAuth, authenticate: authenticateToken ,auth: authenticateToken}; // Ajout de 'authenticate' comme alias