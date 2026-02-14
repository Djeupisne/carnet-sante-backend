const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, AuditLog } = require('../models');
const { logger } = require('../utils/logger');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { ADMIN_USERS } = require('../config/adminUsers'); // ✅ Ajout de l'import

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * POST /api/auth/register
 * ✅ CORRIGÉ DÉFINITIF : Plus AUCUNE validation sur les langues
 */
const register = async (req, res) => {
  // ... (votre code existant, inchangé)
};

/**
 * POST /api/auth/login - MODIFIÉ POUR GÉRER LES ADMINS
 */
const login = async (req, res) => {
  try {
    console.log('\n🔐 === LOGIN CONTROLLER ===');
    const { email, password } = req.body;

    console.log('📥 Email reçu:', email);
    console.log('📥 Mot de passe reçu:', password ? '***' : 'vide');

    if (!email || !password) {
      console.log('❌ Email ou mot de passe manquant');
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    // ✅ ÉTAPE 1: Vérifier si c'est un admin prédéfini
    console.log('👑 Vérification admin...');
    const adminUser = ADMIN_USERS.find(admin => admin.email === email.toLowerCase());

    if (adminUser) {
      console.log('✅ Admin trouvé dans la configuration');
      
      // Vérifier le mot de passe avec bcrypt
      const validPassword = await bcrypt.compare(password, adminUser.passwordHash);

      if (!validPassword) {
        console.log('❌ Mot de passe admin incorrect');
        return res.status(401).json({
          success: false,
          message: 'Email ou mot de passe incorrect'
        });
      }

      console.log('✅ Mot de passe admin valide');

      // Générer un token JWT pour l'admin
      const token = jwt.sign(
        { 
          userId: adminUser.id,
          email: adminUser.email,
          role: adminUser.role,
          isAdmin: true
        },
        process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024',
        { expiresIn: '24h' }
      );

      console.log('🔑 Token admin généré');

      // Log d'audit pour l'admin
      try {
        await AuditLog.create({
          action: 'ADMIN_LOGIN',
          userId: adminUser.id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.get('User-Agent'),
          details: { email: adminUser.email }
        });
        console.log('📝 Log d\'audit admin créé');
      } catch (auditError) {
        console.warn('⚠️ Erreur non-bloquante du log d\'audit:', auditError.message);
      }

      logger.info('Connexion admin réussie', {
        email: adminUser.email
      });

      console.log('🎉 === CONNEXION ADMIN RÉUSSIE ===\n');

      return res.json({
        success: true,
        message: 'Connexion réussie',
        data: {
          user: {
            id: adminUser.id,
            email: adminUser.email,
            firstName: adminUser.firstName,
            lastName: adminUser.lastName,
            role: adminUser.role
          },
          token
        }
      });
    }

    // ✅ ÉTAPE 2: Si ce n'est pas un admin, chercher dans la base de données
    console.log('👤 Admin non trouvé, recherche dans la base de données...');
    
    const user = await User.findOne({ 
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      console.log('❌ Utilisateur non trouvé:', email);
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    console.log('✅ Utilisateur trouvé:', user.email);
    console.log('🔍 Hash stocké présent:', !!user.password);
    console.log('📊 Rôle utilisateur:', user.role);
    console.log('🏥 Spécialité:', user.specialty);

    if (user.isLocked && user.isLocked()) {
      console.log('🔒 Compte verrouillé');
      return res.status(423).json({
        success: false,
        message: 'Compte temporairement verrouillé. Réessayez dans 15 minutes.'
      });
    }

    console.log('🔐 Vérification du mot de passe...');
    const isPasswordValid = await user.comparePassword(password);
    console.log('✅ Résultat comparePassword:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('❌ Mot de passe incorrect');
      
      if (user.incLoginAttempts) {
        try {
          await user.incLoginAttempts();
          console.log('📈 Tentatives mises à jour');
        } catch (incError) {
          console.error('❌ Erreur lors de l\'incrémentation:', incError.message);
        }
      }

      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    console.log('✅ Mot de passe valide');

    console.log('🔄 Réinitialisation des tentatives...');
    if (user.resetLoginAttempts) {
      await user.resetLoginAttempts();
    } else {
      await user.update({
        loginAttempts: 0,
        lockUntil: null,
        lastLogin: new Date()
      });
    }
    console.log('✅ Tentatives réinitialisées');

    console.log('🔑 Génération du token JWT...');
    const token = generateToken(user.id);
    console.log('✅ Token généré');

    try {
      await AuditLog.create({
        action: 'USER_LOGIN',
        userId: user.id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent')
      });
      console.log('📝 Log d\'audit créé');
    } catch (auditError) {
      console.warn('⚠️ Erreur non-bloquante du log d\'audit:', auditError.message);
    }

    logger.info('Connexion réussie', {
      userId: user.id,
      email: user.email,
      role: user.role
    });

    console.log('🎉 === CONNEXION RÉUSSIE ===\n');

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: {
          id: user.id,
          uniqueCode: user.uniqueCode,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          gender: user.gender,
          dateOfBirth: user.dateOfBirth,
          phoneNumber: user.phoneNumber,
          bloodType: user.bloodType,
          specialty: user.specialty,
          licenseNumber: user.licenseNumber,
          biography: user.biography,
          languages: user.languages,
          isVerified: user.isVerified,
          profileCompleted: user.profileCompleted
        },
        token
      }
    });

  } catch (error) {
    console.error('\n❌ Erreur connexion:', error.message);
    console.error('Stack:', error.stack);
    
    logger.error('Erreur de connexion', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la connexion'
    });
  }
};

/**
 * POST /api/auth/admin/login - Route dédiée pour les admins (optionnelle)
 */
const adminLogin = async (req, res) => {
  try {
    console.log('\n👑 === ADMIN LOGIN CONTROLLER ===');
    const { email, password } = req.body;

    const adminUser = ADMIN_USERS.find(admin => admin.email === email.toLowerCase());

    if (!adminUser) {
      return res.status(401).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    const validPassword = await bcrypt.compare(password, adminUser.passwordHash);

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Mot de passe incorrect'
      });
    }

    const token = jwt.sign(
      { 
        userId: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        isAdmin: true
      },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024',
      { expiresIn: '24h' }
    );

    console.log('✅ Admin connecté via route dédiée');

    res.json({
      success: true,
      token,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        role: adminUser.role
      }
    });

  } catch (error) {
    console.error('❌ Erreur admin login:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  // ... (votre code existant, inchangé)
};

/**
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  // ... (votre code existant, inchangé)
};

/**
 * GET /api/auth/me
 */
const getCurrentUser = async (req, res) => {
  // ... (votre code existant, inchangé)
};

/**
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  // ... (votre code existant, inchangé)
};

module.exports = {
  register,
  login,
  adminLogin,        // ✅ Nouvelle exportation
  forgotPassword,
  resetPassword,
  getCurrentUser,
  logout
};
