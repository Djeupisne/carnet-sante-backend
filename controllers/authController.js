const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { User, AuditLog } = require('../models');
const { logger } = require('../utils/logger');
const nodemailer = require('nodemailer');

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * POST /api/auth/register - CORRIGÉ
 */
const register = async (req, res) => {
  try {
    console.log('\n📝 === REGISTER CONTROLLER ===');
    
    // ✅ CORRIGÉ : Récupérer TOUS les champs
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      dateOfBirth, 
      gender, 
      phoneNumber, 
      role,
      bloodType,        // ✅ AJOUT
      specialty,        // ✅ AJOUT
      licenseNumber,    // ✅ AJOUT
      biography,        // ✅ AJOUT
      languages         // ✅ AJOUT
    } = req.body;

    console.log('Données reçues:', {
      email,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      role: role || 'patient',
      bloodType,        // ✅ AJOUT
      specialty,        // ✅ AJOUT
      licenseNumber,    // ✅ AJOUT
      biography: biography ? `${biography.substring(0, 50)}...` : null, // ✅ AJOUT
      languages         // ✅ AJOUT
    });

    // Validation basique avant la création
    if (!email || !password || !firstName || !lastName || !dateOfBirth || !gender) {
      console.log('Champs obligatoires manquants');
      return res.status(400).json({
        success: false,
        message: 'Tous les champs obligatoires doivent être complétés',
        missing: {
          email: !email,
          password: !password,
          firstName: !firstName,
          lastName: !lastName,
          dateOfBirth: !dateOfBirth,
          gender: !gender
        }
      });
    }

    // Vérifier si l'utilisateur existe déjà
    console.log('Vérification de l\'unicité de l\'email...');
    const existingUser = await User.findOne({ 
      where: { email: email.toLowerCase() } 
    });

    if (existingUser) {
      console.log('Email déjà utilisé:', email);
      return res.status(409).json({
        success: false,
        message: 'Un utilisateur avec cet email existe déjà',
        field: 'email'
      });
    }
    console.log('Email disponible');

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ CORRIGÉ : Créer l'utilisateur avec TOUS les champs
    console.log('Création de l\'utilisateur...');
    const userData = {
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth,
      gender,
      phoneNumber: phoneNumber || null,
      role: role || 'patient',
      bloodType: bloodType || null,        // ✅ AJOUT
      specialty: specialty || null,        // ✅ AJOUT
      licenseNumber: licenseNumber || null,// ✅ AJOUT
      biography: biography || null,        // ✅ AJOUT
      languages: languages || null,        // ✅ AJOUT
      isActive: true,
      isVerified: false,
      profileCompleted: false
    };

    console.log('Données utilisateur pour création:', userData);

    const user = await User.create(userData);

    console.log('Utilisateur créé:', { 
      id: user.id, 
      email: user.email,
      uniqueCode: user.uniqueCode,
      role: user.role,
      bloodType: user.bloodType,    // ✅ AJOUT
      specialty: user.specialty     // ✅ AJOUT
    });

    // Générer le token
    console.log('Génération du token JWT...');
    const token = generateToken(user.id);
    console.log('Token généré');

    // Log d'audit (non-bloquant)
    try {
      await AuditLog.create({
        action: 'USER_REGISTRATION',
        userId: user.id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent'),
        details: {
          email: user.email,
          role: user.role,
          uniqueCode: user.uniqueCode,
          bloodType: user.bloodType,  // ✅ AJOUT
          specialty: user.specialty   // ✅ AJOUT
        }
      });
      console.log('Log d\'audit créé');
    } catch (auditError) {
      console.warn('Erreur non-bloquante du log d\'audit:', auditError.message);
    }

    logger.info('Enregistrement réussi', {
      userId: user.id,
      email: user.email,
      role: user.role
    });

    console.log('✓ Enregistrement réussi\n');

    // ✅ CORRIGÉ : Retourner tous les champs dans la réponse
    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
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
          bloodType: user.bloodType,        // ✅ AJOUT
          specialty: user.specialty,        // ✅ AJOUT
          licenseNumber: user.licenseNumber,// ✅ AJOUT
          biography: user.biography,        // ✅ AJOUT
          languages: user.languages,        // ✅ AJOUT
          isVerified: user.isVerified
        },
        token
      }
    });

  } catch (error) {
    console.error('\n❌ Erreur enregistrement:', error.message);
    console.error('Stack:', error.stack);
    
    // ✅ AMÉLIORÉ : Meilleur logging des erreurs
    console.error('Données reçues qui ont causé l\'erreur:', req.body);
    
    logger.error('Erreur d\'enregistrement', {
      error: error.message,
      email: req.body.email,
      role: req.body.role
    });

    // Erreurs Sequelize
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(err => ({
        field: err.path,
        message: err.message
      }));
      console.error('Erreurs de validation Sequelize:', messages);
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors: messages
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      console.error('Erreur de contrainte unique:', error.errors);
      return res.status(409).json({
        success: false,
        message: 'Cette valeur est déjà utilisée',
        field: error.errors[0].path
      });
    }

    // ✅ AJOUT : Gestion des erreurs de type de données
    if (error.name === 'SequelizeDatabaseError') {
      console.error('Erreur de base de données:', error.message);
      return res.status(400).json({
        success: false,
        message: 'Erreur de format de données',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'enregistrement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    console.log('\n🔐 === LOGIN CONTROLLER ===');
    const { email, password } = req.body;

    console.log('Email reçu:', email);
    console.log('Mot de passe reçu: (longueur)', password ? password.length : 'vide');

    if (!email || !password) {
      console.log('Email ou mot de passe manquant');
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    // Trouver l'utilisateur
    console.log('Recherche de l\'utilisateur...');
    const user = await User.findOne({ 
      where: { email: email.toLowerCase() },
      raw: false // Important: pour avoir accès aux méthodes du modèle
    });

    if (!user) {
      console.log('Utilisateur non trouvé:', email);
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    console.log('Utilisateur trouvé:', user.email);
    console.log('Hash stocké:', user.password ? `${user.password.substring(0, 30)}...` : 'null');

    // Vérifier le verrouillage du compte
    if (user.isLocked()) {
      console.log('Compte verrouillé');
      return res.status(423).json({
        success: false,
        message: 'Compte temporairement verrouillé. Réessayez dans 15 minutes.'
      });
    }

    // Vérifier le mot de passe
    console.log('Vérification du mot de passe...');
    console.log('Mot de passe candidat (longueur):', password.length);

    let isPasswordValid = false;
    try {
      isPasswordValid = await user.comparePassword(password);
      console.log('Résultat comparePassword:', isPasswordValid);
    } catch (compareError) {
      console.error('Erreur lors de la comparaison:', compareError.message);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification du mot de passe'
      });
    }

    if (!isPasswordValid) {
      console.log('Mot de passe incorrect');
      console.log('Incrémentation des tentatives de connexion...');
      
      try {
        await user.incLoginAttempts();
        console.log('Tentatives mises à jour');
      } catch (incError) {
        console.error('Erreur lors de l\'incrémentation:', incError.message);
      }

      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    console.log('Mot de passe valide');

    // Réinitialiser les tentatives
    console.log('Réinitialisation des tentatives et mise à jour du lastLogin...');
    await user.update({
      loginAttempts: 0,
      lockUntil: null,
      lastLogin: new Date()
    });

    console.log('Tentatives réinitialisées');

    // Générer le token
    console.log('Génération du token JWT...');
    const token = generateToken(user.id);
    console.log('Token généré');

    // Log d'audit
    try {
      await AuditLog.create({
        action: 'USER_LOGIN',
        userId: user.id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.warn('Erreur non-bloquante du log d\'audit:', auditError.message);
    }

    logger.info('Connexion réussie', {
      userId: user.id,
      email: user.email
    });

    console.log('✓ === CONNEXION RÉUSSIE ===\n');

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
          isVerified: user.isVerified
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
      message: 'Erreur serveur'
    });
  }
};

/**
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    console.log('\n📧 === FORGOT PASSWORD CONTROLLER ===');
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email requis'
      });
    }

    const user = await User.findOne({ 
      where: { email: email.toLowerCase() } 
    });

    // Toujours retourner le même message pour la sécurité
    if (!user) {
      console.log('Email non trouvé (sécurité)');
      return res.json({
        success: true,
        message: 'Si un compte avec cet email existe, un lien de réinitialisation a été envoyé'
      });
    }

    // Générer un token de réinitialisation
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 heure

    await user.update({
      resetToken,
      resetTokenExpiry
    });

    console.log('Token de réinitialisation généré');

    // Envoyer un email avec nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe',
      text: `Utilisez ce lien pour réinitialiser votre mot de passe : http://localhost:3000/reset-password?token=${resetToken}`,
    });

    console.log('Email de réinitialisation envoyé');

    res.json({
      success: true,
      message: 'Si un compte avec cet email existe, un lien de réinitialisation a été envoyé'
    });

  } catch (error) {
    console.error('\n❌ Erreur forgot password:', error.message);
    logger.error('Erreur de demande de réinitialisation', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    console.log('\n🔑 === RESET PASSWORD CONTROLLER ===');
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token et mot de passe requis'
      });
    }

    const { Op } = require('sequelize');
    const user = await User.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: { [Op.gt]: Date.now() }
      }
    });

    if (!user) {
      console.log('Token invalide ou expiré');
      return res.status(400).json({
        success: false,
        message: 'Token de réinitialisation invalide ou expiré'
      });
    }

    // Hacher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Mettre à jour le mot de passe
    await user.update({
      password: hashedPassword,
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
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.warn('Erreur non-bloquante du log d\'audit:', auditError.message);
    }

    console.log('Mot de passe réinitialisé\n');

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès'
    });

  } catch (error) {
    console.error('\n❌ Erreur reset password:', error.message);
    logger.error('Erreur de réinitialisation', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/auth/me
 */
const getCurrentUser = async (req, res) => {
  try {
    console.log('\n👤 === GET CURRENT USER CONTROLLER ===');
    console.log('User ID:', req.user.id);

    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isVerified: user.isVerified
        }
      }
    });

  } catch (error) {
    console.error('\n❌ Erreur getCurrentUser:', error.message);
    logger.error('Erreur lors de la récupération de l\'utilisateur', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    console.log('\n🚪 === LOGOUT CONTROLLER ===');
    console.log('User ID:', req.user.id);

    // Log d'audit
    try {
      await AuditLog.create({
        action: 'USER_LOGOUT',
        userId: req.user.id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.warn('Erreur non-bloquante du log d\'audit:', auditError.message);
    }

    console.log('Déconnexion enregistrée\n');

    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });

  } catch (error) {
    console.error('\n❌ Erreur logout:', error.message);
    logger.error('Erreur de déconnexion', {
      error: error.message
    });

    // Même en cas d'erreur, on retourne un succès
    res.json({
      success: true,
      message: 'Déconnexion effectuée'
    });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  logout
};