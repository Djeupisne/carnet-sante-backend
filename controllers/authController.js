const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, AuditLog } = require('../models');
const { logger } = require('../utils/logger');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { Op } = require('sequelize');

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * POST /api/auth/register
 * ✅ CORRIGÉ DÉFINITIF : Plus AUCUNE valeur par défaut forcée
 */
const register = async (req, res) => {
  try {
    console.log('\n📝 === REGISTER CONTROLLER ===');
    console.log('📥 Données brutes reçues:', JSON.stringify(req.body, null, 2));
    
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      dateOfBirth, 
      gender, 
      phoneNumber, 
      role = 'patient',
      bloodType,
      specialty,
      licenseNumber,
      biography,
      languages
    } = req.body;

    console.log('🔍 === ANALYSE DES DONNÉES REÇUES ===');
    console.log('📧 Email:', email, '(type:', typeof email, ')');
    console.log('👤 Prénom:', firstName, '(longueur:', firstName ? firstName.length : 0, ')');
    console.log('👤 Nom:', lastName, '(longueur:', lastName ? lastName.length : 0, ')');
    console.log('📅 Date de naissance:', dateOfBirth);
    console.log('⚧️ Genre:', gender);
    console.log('🎭 Rôle:', role);
    console.log('🏥 Spécialité:', specialty);
    console.log('📋 Numéro de licence:', licenseNumber);
    console.log('📝 Biographie longueur:', biography ? biography.length : 0, 'caractères');
    console.log('📝 Biographie trimmed longueur:', biography ? biography.trim().length : 0, 'caractères');
    console.log('🌐 Languages:', languages);
    console.log('🌐 Languages type:', typeof languages);
    console.log('🌐 Languages est un tableau?', Array.isArray(languages));
    console.log('🩸 Groupe sanguin:', bloodType);
    console.log('📱 Téléphone:', phoneNumber);

    const errors = [];

    if (!email || !email.trim()) {
      errors.push({ field: 'email', message: 'Email requis' });
    }
    
    if (!password || password.length < 6) {
      errors.push({ field: 'password', message: 'Mot de passe requis (min 6 caractères)' });
    }
    
    if (!firstName || !firstName.trim()) {
      errors.push({ field: 'firstName', message: 'Prénom requis' });
    }
    
    if (!lastName || !lastName.trim()) {
      errors.push({ field: 'lastName', message: 'Nom requis' });
    }
    
    if (!dateOfBirth) {
      errors.push({ field: 'dateOfBirth', message: 'Date de naissance requise' });
    }
    
    if (!gender) {
      errors.push({ field: 'gender', message: 'Genre requis' });
    }

    // ✅ CORRIGÉ : Plus AUCUNE valeur par défaut automatique !
    if (role === 'doctor' || role === 'docteur' || role === 'médecin') {
      console.log('🔍 Validation médecin...');
      
      if (!specialty || !specialty.trim()) {
        errors.push({ field: 'specialty', message: 'Spécialité requise pour les médecins' });
      }
      
      if (!licenseNumber || !licenseNumber.trim()) {
        errors.push({ field: 'licenseNumber', message: 'Numéro de licence requis pour les médecins' });
      }
      
      if (!biography || !biography.trim()) {
        errors.push({ field: 'biography', message: 'Biographie requise pour les médecins' });
      }
      
      if (!languages) {
        errors.push({ field: 'languages', message: 'Au moins une langue doit être spécifiée' });
      } else if (!Array.isArray(languages)) {
        console.log('⚠️ Languages n\'est pas un tableau, conversion en cours...');
        if (typeof languages === 'string') {
          try {
            const parsed = JSON.parse(languages);
            if (Array.isArray(parsed)) {
              languages = parsed;
            } else {
              languages = [languages];
            }
          } catch (e) {
            languages = [languages];
          }
        } else {
          languages = [];
        }
        console.log('✅ Languages après conversion:', languages);
      }
      
      if (Array.isArray(languages) && languages.length === 0) {
        errors.push({ field: 'languages', message: 'Au moins une langue doit être spécifiée' });
      }
    }

    if (errors.length > 0) {
      console.log('❌ Erreurs de validation:', errors);
      return res.status(400).json({
        success: false,
        message: 'Erreurs de validation',
        errors: errors
      });
    }

    console.log('🔍 Vérification de l\'unicité de l\'email...');
    const existingUser = await User.findOne({ 
      where: { email: email.toLowerCase() } 
    });

    if (existingUser) {
      console.log('❌ Email déjà utilisé:', email);
      return res.status(409).json({
        success: false,
        message: 'Un utilisateur avec cet email existe déjà',
        field: 'email'
      });
    }
    console.log('✅ Email disponible');

    console.log('📦 Préparation des données utilisateur...');
    const userData = {
      email: email.toLowerCase(),
      password,
      firstName: firstName ? firstName.trim() : null,
      lastName: lastName ? lastName.trim() : null,
      dateOfBirth,
      gender,
      phoneNumber: phoneNumber || null,
      role: role === 'docteur' || role === 'médecin' ? 'doctor' : role,
      bloodType: bloodType || null,
      isActive: true,
      isVerified: false,
      profileCompleted: false
    };

    // ✅ CORRIGÉ : On garde EXACTEMENT ce que l'utilisateur a saisi !
    if (role === 'doctor' || role === 'docteur' || role === 'médecin') {
      userData.specialty = specialty ? specialty.trim() : null;
      userData.licenseNumber = licenseNumber ? licenseNumber.trim() : null;
      userData.biography = biography ? biography.trim() : null;
      
      if (languages) {
        if (Array.isArray(languages)) {
          userData.languages = languages;
        } else if (typeof languages === 'string') {
          try {
            userData.languages = JSON.parse(languages);
          } catch (e) {
            userData.languages = [languages];
          }
        } else {
          userData.languages = [];
        }
      } else {
        userData.languages = [];
      }
    }

    console.log('📤 Données utilisateur pour création (sans password):', {
      ...userData,
      password: '*** SERA HASHÉ PAR LE HOOK ***',
      specialty: userData.specialty,
      licenseNumber: userData.licenseNumber,
      biography: userData.biography ? userData.biography.substring(0, 50) + '...' : null,
      languages: userData.languages
    });

    console.log('⚙️ Création de l\'utilisateur dans la base de données...');
    const user = await User.create(userData);

    console.log('✅ Utilisateur créé avec succès:', { 
      id: user.id, 
      email: user.email,
      uniqueCode: user.uniqueCode,
      role: user.role,
      specialty: user.specialty, // ✅ C'est la VRAIE valeur saisie !
      licenseNumber: user.licenseNumber,
      biographyLength: user.biography ? user.biography.length : 0,
      languages: user.languages
    });

    console.log('🔑 Génération du token JWT...');
    const token = generateToken(user.id);
    console.log('✅ Token généré');

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
          specialty: user.specialty
        }
      });
      console.log('📝 Log d\'audit créé');
    } catch (auditError) {
      console.warn('⚠️ Erreur non-bloquante du log d\'audit:', auditError.message);
    }

    logger.info('Enregistrement réussi', {
      userId: user.id,
      email: user.email,
      role: user.role,
      specialty: user.specialty
    });

    console.log('🎉 === ENREGISTREMENT RÉUSSI ===\n');

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
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
          specialty: user.specialty, // ✅ La VRAIE valeur !
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
    console.error('\n❌ === ERREUR DÉTAILLÉE ENREGISTREMENT ===');
    console.error('Message:', error.message);
    console.error('Nom:', error.name);
    console.error('Stack:', error.stack);
    
    if (error.errors) {
      console.error('Erreurs Sequelize détaillées:');
      error.errors.forEach((err, index) => {
        console.error(`  ${index + 1}. Champ: ${err.path}, Message: ${err.message}, Valeur: ${err.value}`);
      });
    }
    
    console.error('Données qui ont causé l\'erreur:', {
      email: req.body.email,
      role: req.body.role,
      specialty: req.body.specialty,
      biographyLength: req.body.biography ? req.body.biography.length : 0
    });
    
    logger.error('Erreur d\'enregistrement', {
      error: error.message,
      name: error.name,
      email: req.body.email,
      role: req.body.role
    });

    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      console.error('❌ Erreurs de validation Sequelize:', messages);
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation des données',
        errors: messages,
        errorType: 'SequelizeValidationError'
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      console.error('❌ Erreur de contrainte unique:', error.errors);
      return res.status(409).json({
        success: false,
        message: 'Cette valeur est déjà utilisée',
        field: error.errors[0].path,
        value: error.errors[0].value,
        errorType: 'SequelizeUniqueConstraintError'
      });
    }

    if (error.name === 'SequelizeDatabaseError') {
      console.error('❌ Erreur de base de données:', error.message);
      return res.status(400).json({
        success: false,
        message: 'Erreur de base de données',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur de format de données',
        errorType: 'SequelizeDatabaseError'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'enregistrement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      errorType: 'ServerError'
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

    console.log('📥 Email reçu:', email);
    console.log('📥 Mot de passe reçu:', password ? '***' : 'vide');

    if (!email || !password) {
      console.log('❌ Email ou mot de passe manquant');
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

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

    if (!user) {
      console.log('📭 Email non trouvé (sécurité)');
      return res.json({
        success: true,
        message: 'Si un compte avec cet email existe, un lien de réinitialisation a été envoyé'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000;

    await user.update({
      resetToken,
      resetTokenExpiry
    });

    console.log('🔑 Token de réinitialisation généré');

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
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
          html: `
            <h2>Réinitialisation de mot de passe</h2>
            <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
            <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}">
              Réinitialiser mon mot de passe
            </a>
            <p>Ce lien expire dans 1 heure.</p>
            <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
          `,
        });

        console.log('📧 Email de réinitialisation envoyé');
      } catch (emailError) {
        console.error('❌ Erreur d\'envoi d\'email:', emailError.message);
      }
    } else {
      console.log('⚠️ Configuration email manquante, token généré mais email non envoyé');
    }

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

    const user = await User.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: { [Op.gt]: Date.now() }
      }
    });

    if (!user) {
      console.log('❌ Token invalide ou expiré');
      return res.status(400).json({
        success: false,
        message: 'Token de réinitialisation invalide ou expiré'
      });
    }

    console.log('🔐 Hachage du nouveau mot de passe...');
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('✅ Mot de passe hashé');

    await user.update({
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
      loginAttempts: 0,
      lockUntil: null,
      lastPasswordChange: new Date()
    }, { hooks: false });

    console.log('✅ Mot de passe réinitialisé');

    try {
      await AuditLog.create({
        action: 'PASSWORD_RESET',
        userId: user.id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent')
      });
      console.log('📝 Log d\'audit créé');
    } catch (auditError) {
      console.warn('⚠️ Erreur non-bloquante du log d\'audit:', auditError.message);
    }

    console.log('🎉 Réinitialisation réussie\n');

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
    console.log('🔍 User ID:', req.user.id);

    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    console.log('✅ Utilisateur récupéré:', user.email);
    console.log('🏥 Spécialité:', user.specialty);
    console.log('📝 Role:', user.role);

    res.json({
      success: true,
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
          profileCompleted: user.profileCompleted,
          profilePicture: user.profilePicture
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
    console.log('🔍 User ID:', req.user.id);

    try {
      await AuditLog.create({
        action: 'USER_LOGOUT',
        userId: req.user.id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent')
      });
      console.log('📝 Log d\'audit créé');
    } catch (auditError) {
      console.warn('⚠️ Erreur non-bloquante du log d\'audit:', auditError.message);
    }

    console.log('🎉 Déconnexion enregistrée\n');

    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });

  } catch (error) {
    console.error('\n❌ Erreur logout:', error.message);
    logger.error('Erreur de déconnexion', {
      error: error.message
    });

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
