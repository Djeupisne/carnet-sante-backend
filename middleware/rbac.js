const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Non authentifié' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.warn(`⛔ Accès refusé: ${req.user.role} tente d'accéder à ${allowedRoles.join('/')}`);
      return res.status(403).json({ 
        success: false, 
        message: 'Accès non autorisé' 
      });
    }

    next();
  };
};

// Middleware pour vérifier si l'utilisateur est admin
const isAdmin = checkRole(['admin']);

// Middleware pour vérifier si l'utilisateur est médecin ou admin
const isDoctorOrAdmin = checkRole(['doctor', 'admin']);

// Middleware pour vérifier si l'utilisateur est patient ou admin
const isPatientOrAdmin = checkRole(['patient', 'admin']);

module.exports = { checkRole, isAdmin, isDoctorOrAdmin, isPatientOrAdmin };
