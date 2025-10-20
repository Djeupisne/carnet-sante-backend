const jwt = require('jsonwebtoken');
const { User, AuditLog } = require('../models');
const validationService = require('../services/validationService');
const encryptionService = require('../services/encryptionService');

class AuthService {
  /**
   * Générer un JWT token
   */
  generateToken(userId) {
    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    return token;
  }

  /**
   * Vérifier un JWT token
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024'
      );
      return decoded;
    } catch (error) {
      throw new Error('Token invalide ou expiré');
    }
  }

  /**
   * Enregistrer un nouvel utilisateur
   */
  async register(userData) {
    try {
      console.log('\n📝 === DÉBUT ENREGISTREMENT UTILISATEUR ===');
      console.log('Données reçues:', {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role
      });

      // Étape 1: Validation
      console.log('Étape 1: Validation des données');
      const validation = validationService.validateUserRegistration(userData);
      
      if (!validation.isValid) {
        console.log('Erreurs de validation:', validation.errors);
        const error = new Error('Données invalides');
        error.statusCode = 400;
        error.errors = validation.errors;
        throw error;
      }
      console.log('✓ Validation réussie');

      // Étape 2: Vérifier l'unicité de l'email
      console.log('Étape 2: Vérification de l\'unicité de l\'email');
      const existingUser = await User.findOne({
        where: { email: userData.email.toLowerCase() }
      });

      if (existingUser) {
        console.log('Email déjà utilisé:', userData.email);
        const error = new Error('Un utilisateur avec cet email existe déjà');
        error.statusCode = 409;
        error.field = 'email';
        throw error;
      }
      console.log('✓ Email disponible');

      // Étape 3: Créer l'utilisateur
      console.log('Étape 3: Création de l\'utilisateur');
      const user = await User.create({
        email: userData.email.toLowerCase(),
        password: userData.password,
        firstName: userData.firstName.trim(),
        lastName: userData.lastName.trim(),
        dateOfBirth: userData.dateOfBirth,
        gender: userData.gender,
        phoneNumber: userData.phoneNumber || null,
        role: userData.role || 'patient',
        isActive: true,
        isVerified: false,
        profileCompleted: false
      });

      console.log('✓ Utilisateur créé avec succès:', {
        id: user.id,
        uniqueCode: user.uniqueCode,
        email: user.email
      });

      // Étape 4: Générer le token JWT
      console.log('Étape 4: Génération du token JWT');
      const token = this.generateToken(user.id);
      console.log('✓ Token généré');

      // Étape 5: Créer un log d'audit
      console.log('Étape 5: Création du log d\'audit');
      try {
        await AuditLog.create({
          action: 'USER_REGISTRATION',
          userId: user.id,
          ipAddress: userData.ipAddress || '127.0.0.1',
          userAgent: userData.userAgent,
          details: {
            email: user.email,
            role: user.role,
            uniqueCode: user.uniqueCode
          }
        });
        console.log('✓ Log d\'audit créé');
      } catch (auditError) {
        console.warn('⚠️ Erreur non-bloquante lors du log d\'audit:', auditError.message);
      }

      console.log('✓ === ENREGISTREMENT RÉUSSI ===\n');

      // Retourner les données utilisateur (sans le mot de passe)
      return {
        success: true,
        message: 'Utilisateur créé avec succès',
        user: this.formatUserResponse(user),
        token
      };

    } catch (error) {
      console.error('❌ ERREUR ENREGISTREMENT:', error.message);
      throw error;
    }
  }

  /**
   * Connexion utilisateur
   */
  async login(email, password, ipAddress, userAgent) {
    try {
      console.log('\n🔐 === DÉBUT CONNEXION ===');
      console.log('Email:', email);

      // Validation basique
      if (!email || !password) {
        const error = new Error('Email et mot de passe requis');
        error.statusCode = 400;
        throw error;
      }

      // Chercher l'utilisateur
      const user = await User.findOne({
        where: { email: email.toLowerCase() }
      });

      if (!user) {
        console.log('Utilisateur non trouvé');
        const error = new Error('Identifiants invalides');
        error.statusCode = 401;
        throw error;
      }

      // Vérifier si le compte est verrouillé
      if (user.isLocked()) {
        console.log('Compte verrouillé');
        const error = new Error('Compte temporairement verrouillé. Réessayez dans 15 minutes.');
        error.statusCode = 423;
        throw error;
      }

      // Vérifier le mot de passe
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        console.log('Mot de passe incorrect, incrémentation des tentatives');
        await user.incLoginAttempts();
        const error = new Error('Identifiants invalides');
        error.statusCode = 401;
        throw error;
      }

      // Réinitialiser les tentatives et mettre à jour lastLogin
      await user.update({
        loginAttempts: 0,
        lockUntil: null,
        lastLogin: new Date()
      });

      // Générer le token
      const token = this.generateToken(user.id);

      // Log d'audit
      try {
        await AuditLog.create({
          action: 'USER_LOGIN',
          userId: user.id,
          ipAddress: ipAddress || '127.0.0.1',
          userAgent: userAgent
        });
      } catch (auditError) {
        console.warn('⚠️ Erreur non-bloquante lors du log d\'audit:', auditError.message);
      }

      console.log('✓ === CONNEXION RÉUSSIE ===\n');

      return {
        success: true,
        message: 'Connexion réussie',
        user: this.formatUserResponse(user),
        token
      };

    } catch (error) {
      console.error('❌ ERREUR CONNEXION:', error.message);
      throw error;
    }
  }

  /**
   * Obtenir l'utilisateur courant par ID
   */
  async getCurrentUser(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: {
          exclude: ['password', 'resetToken', 'resetTokenExpiry', 'emailVerificationToken']
        }
      });

      if (!user) {
        const error = new Error('Utilisateur non trouvé');
        error.statusCode = 404;
        throw error;
      }

      return {
        success: true,
        user: this.formatUserResponse(user)
      };

    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error.message);
      throw error;
    }
  }

  /**
   * Demande de réinitialisation de mot de passe
   */
  async forgotPassword(email, ipAddress, userAgent) {
    try {
      const user = await User.findOne({
        where: { email: email.toLowerCase() }
      });

      // Toujours retourner le même message pour la sécurité
      if (!user) {
        console.log('Email non trouvé pour réinitialisation');
        return {
          success: true,
          message: 'Si un compte avec cet email existe, un lien de réinitialisation a été envoyé'
        };
      }

      // Générer un token de réinitialisation
      const resetToken = encryptionService.generateResetToken();
      const resetTokenExpiry = Date.now() + 3600000; // 1 heure

      await user.update({
        resetToken,
        resetTokenExpiry
      });

      // Log d'audit
      try {
        await AuditLog.create({
          action: 'PASSWORD_RESET_REQUEST',
          userId: user.id,
          ipAddress: ipAddress || '127.0.0.1',
          userAgent: userAgent
        });
      } catch (auditError) {
        console.warn('⚠️ Erreur non-bloquante lors du log d\'audit:', auditError.message);
      }

      // TODO: Envoyer un email avec le lien de réinitialisation
      // await emailService.sendPasswordResetEmail(user.email, resetToken);

      console.log('Token de réinitialisation généré pour:', email);

      return {
        success: true,
        message: 'Si un compte avec cet email existe, un lien de réinitialisation a été envoyé'
      };

    } catch (error) {
      console.error('Erreur lors de la demande de réinitialisation:', error.message);
      throw error;
    }
  }

  /**
   * Réinitialiser le mot de passe
   */
  async resetPassword(token, newPassword, ipAddress, userAgent) {
    try {
      // Validation
      if (!token || !newPassword) {
        const error = new Error('Token et nouveau mot de passe requis');
        error.statusCode = 400;
        throw error;
      }

      // Valider le mot de passe
      const passwordValidation = validationService.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        const error = new Error('Mot de passe invalide');
        error.statusCode = 400;
        error.errors = passwordValidation.errors;
        throw error;
      }

      // Trouver l'utilisateur avec ce token
      const user = await User.findOne({
        where: {
          resetToken: token,
          resetTokenExpiry: { [require('sequelize').Op.gt]: Date.now() }
        }
      });

      if (!user) {
        const error = new Error('Token de réinitialisation invalide ou expiré');
        error.statusCode = 400;
        throw error;
      }

      // Mettre à jour le mot de passe
      await user.update({
        password: newPassword,
        resetToken: null,
        resetTokenExpiry: null,
        loginAttempts: 0,
        lockUntil: null
      });

      // Log d'audit
      try {
        await AuditLog.create({
          action: 'PASSWORD_RESET',
          userId: user.id,
          ipAddress: ipAddress || '127.0.0.1',
          userAgent: userAgent
        });
      } catch (auditError) {
        console.warn('⚠️ Erreur non-bloquante lors du log d\'audit:', auditError.message);
      }

      console.log('Mot de passe réinitialisé pour l\'utilisateur:', user.id);

      return {
        success: true,
        message: 'Mot de passe réinitialisé avec succès'
      };

    } catch (error) {
      console.error('Erreur lors de la réinitialisation du mot de passe:', error.message);
      throw error;
    }
  }

  /**
   * Logout (enregistrement dans les logs)
   */
  async logout(userId, ipAddress, userAgent) {
    try {
      await AuditLog.create({
        action: 'USER_LOGOUT',
        userId: userId,
        ipAddress: ipAddress || '127.0.0.1',
        userAgent: userAgent
      });

      return {
        success: true,
        message: 'Déconnexion réussie'
      };

    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error.message);
      throw error;
    }
  }

  /**
   * Formater la réponse utilisateur (exclure les champs sensibles)
   */
  formatUserResponse(user) {
    return {
      id: user.id,
      uniqueCode: user.uniqueCode,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      phoneNumber: user.phoneNumber,
      isActive: user.isActive,
      isVerified: user.isVerified,
      profileCompleted: user.profileCompleted,
      profilePicture: user.profilePicture,
      timezone: user.timezone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}

module.exports = new AuthService();