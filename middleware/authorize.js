const authorize = (role) => {
  return (req, res, next) => {
    // Vérifier que l'utilisateur est authentifié
    if (!req.user) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    // Vérifier que l'utilisateur a le rôle requis
    if (req.user.role !== role) {
      return res.status(403).json({ 
        message: `Accès refusé. Rôle requis: ${role}` 
      });
    }

    next();
  };
};

module.exports = authorize;