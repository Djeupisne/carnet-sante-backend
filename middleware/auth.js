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

    // ✅ Vérifier si c'est un token admin (sans passer par la base de données)
    if (token.startsWith('admin-')) {
      try {
        // Décoder le token admin (format: header.payload.signature)
        const parts = token.split('.');
        if (parts.length === 3) {
          // Décoder le payload (partie du milieu)
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          
          if (payload.role === 'admin') {
            console.log('✅ Admin authentifié:', payload.email);
            req.user = {
              id: payload.userId,
              email: payload.email,
              role: 'admin',
              firstName: payload.firstName || 'Admin',
              lastName: payload.lastName || 'User',
              isAdmin: true
            };
            return next();
          }
        }
        
        // Fallback pour les anciens tokens
        console.log('⚠️ Token admin avec format ancien');
        req.user = {
          id: token.split('-')[1] || 'admin-1',
          email: 'admin@carnetsante.com',
          role: 'admin',
          firstName: 'Super',
          lastName: 'Admin',
          isAdmin: true
        };
        return next();
      } catch (decodeError) {
        console.error('❌ Erreur décodage token admin:', decodeError.message);
        return res.status(401).json({
          success: false,
          message: 'Token admin invalide'
        });
      }
    }

    // Pour les tokens normaux, vérifier JWT standard
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024');
      
      const user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Compte désactivé'
        });
      }

      req.user = user;
      next();
    } catch (jwtError) {
      console.error('❌ Erreur JWT:', jwtError.message);

      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Token invalide'
        });
      }

      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expiré'
        });
      }

      throw jwtError;
    }
  } catch (error) {
    console.error('❌ Erreur d\'authentification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur d\'authentification'
    });
  }
};

// Middleware pour autoriser des rôles spécifiques
const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    if (!roles.includes(req.user.role)) {
      console.warn(`⛔ Accès refusé: ${req.user.role} tente d'accéder à ${roles.join('/')}`);
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
      // Vérifier token admin
      if (token.startsWith('admin-')) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            if (payload.role === 'admin') {
              req.user = {
                id: payload.userId,
                email: payload.email,
                role: 'admin',
                firstName: payload.firstName || 'Admin',
                lastName: payload.lastName || 'User',
                isAdmin: true
              };
              return next();
            }
          }
        } catch (e) {
          // Ignorer
        }
      } else {
        // Token normal
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024');
          const user = await User.findByPk(decoded.userId, {
            attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] }
          });

          if (user && user.isActive) {
            req.user = user;
          }
        } catch (e) {
          // Ignorer
        }
      }
    }

    next();
  } catch (error) {
    // En cas d'erreur, continuer sans authentification
    next();
  }
};

module.exports = { 
  authenticateToken, 
  authorizeRole, 
  optionalAuth, 
  authenticate: authenticateToken,
  auth: authenticateToken
};
