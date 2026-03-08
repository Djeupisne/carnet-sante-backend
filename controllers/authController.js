// controllers/authController.js
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const { Op }   = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const { User, AuditLog }    = require('../models');
const { logger }             = require('../utils/logger');
const { ADMIN_USERS }        = require('../config/adminUsers');
const notificationService    = require('../services/notificationService');
const emailService           = require('../services/emailService');

const FRONTEND_URL  = process.env.FRONTEND_URL || 'https://carnet-sante-frontend.onrender.com';
const RESET_EXPIRY  = 60 * 60 * 1000; // 1 heure en ms
const RESET_EXPIRY_MINUTES = 60;

const generateToken = (userId) =>
  jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    console.log('\n📝 === REGISTER CONTROLLER ===');

    let {
      email, password, firstName, lastName,
      dateOfBirth, gender, phoneNumber, role = 'patient',
      bloodType, specialty, licenseNumber, biography, languages
    } = req.body;

    // Bloquer les emails admin
    if (ADMIN_USERS.some(a => a.email === email?.toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Cet email ne peut pas être utilisé pour créer un compte' });
    }

    // Validation
    const errors = [];
    if (!email?.trim())           errors.push({ field: 'email',       message: 'Email requis' });
    if (!password || password.length < 6)
                                   errors.push({ field: 'password',    message: 'Mot de passe requis (min 6 caractères)' });
    if (!firstName?.trim())        errors.push({ field: 'firstName',   message: 'Prénom requis' });
    if (!lastName?.trim())         errors.push({ field: 'lastName',    message: 'Nom requis' });
    if (!dateOfBirth)              errors.push({ field: 'dateOfBirth', message: 'Date de naissance requise' });
    if (!gender)                   errors.push({ field: 'gender',      message: 'Genre requis' });

    const isDoctor = ['doctor', 'docteur', 'médecin'].includes(role);
    if (isDoctor) {
      if (!specialty?.trim())      errors.push({ field: 'specialty',     message: 'Spécialité requise' });
      if (!licenseNumber?.trim())  errors.push({ field: 'licenseNumber', message: 'Numéro de licence requis' });
      if (!biography?.trim())      errors.push({ field: 'biography',     message: 'Biographie requise' });
      languages = Array.isArray(languages) ? languages
                  : typeof languages === 'string' ? (() => { try { const p = JSON.parse(languages); return Array.isArray(p) ? p : [languages]; } catch { return [languages]; } })()
                  : [];
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Erreurs de validation', errors });
    }

    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Un utilisateur avec cet email existe déjà', field: 'email' });
    }

    const userData = {
      email: email.toLowerCase(),
      password,
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      dateOfBirth,
      gender,
      phoneNumber: phoneNumber || null,
      role: isDoctor ? 'doctor' : role,
      bloodType: bloodType || null,
      isActive: true,
      isVerified: false,
      profileCompleted: false
    };

    if (isDoctor) {
      userData.specialty     = specialty.trim();
      userData.licenseNumber = licenseNumber.trim();
      userData.biography     = biography.trim();
      userData.languages     = languages;
    }

    const user  = await User.create(userData);
    const token = generateToken(user.id);

    // Notification de bienvenue (email ou SMS) – non bloquante
    notificationService.sendWelcomeNotification(user).catch(err =>
      console.warn('⚠️ Erreur notification bienvenue:', err.message)
    );

    AuditLog.create({
      action: 'USER_REGISTRATION', userId: user.id,
      ipAddress: req.ip || '127.0.0.1', userAgent: req.get('User-Agent'),
      details: { email: user.email, role: user.role, uniqueCode: user.uniqueCode }
    }).catch(e => console.warn('⚠️ Audit log:', e.message));

    logger.info('Enregistrement réussi', { userId: user.id, email: user.email, role: user.role });

    return res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      data: {
        user: {
          id: user.id, uniqueCode: user.uniqueCode, email: user.email,
          firstName: user.firstName, lastName: user.lastName, role: user.role,
          gender: user.gender, dateOfBirth: user.dateOfBirth, phoneNumber: user.phoneNumber,
          bloodType: user.bloodType, specialty: user.specialty, licenseNumber: user.licenseNumber,
          biography: user.biography, languages: user.languages,
          isVerified: user.isVerified, profileCompleted: user.profileCompleted
        },
        token
      }
    });

  } catch (error) {
    console.error('❌ Erreur register:', error.message);
    logger.error('Erreur enregistrement', { error: error.message });

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ success: false, message: 'Erreur de validation', errors: error.errors.map(e => ({ field: e.path, message: e.message })) });
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: 'Cette valeur est déjà utilisée', field: error.errors[0].path });
    }
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'enregistrement' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    console.log('\n🔐 === LOGIN CONTROLLER ===');
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
    }

    // Vérification admin
    const adminUser = ADMIN_USERS.find(a => a.email === email.toLowerCase());
    if (adminUser) {
      const validPassword = await bcrypt.compare(password, adminUser.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
      }
      const adminId = uuidv4();
      const token = jwt.sign(
        { userId: adminId, email: adminUser.email, role: adminUser.role, isAdmin: true, firstName: adminUser.firstName, lastName: adminUser.lastName },
        process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024',
        { expiresIn: '24h' }
      );
      return res.json({
        success: true, message: 'Connexion réussie',
        data: {
          user: { id: adminId, email: adminUser.email, firstName: adminUser.firstName, lastName: adminUser.lastName, role: adminUser.role, uniqueCode: 'ADMIN', isVerified: true, isActive: true, profileCompleted: true },
          token
        }
      });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    if (user.isLocked?.()) {
      return res.status(423).json({ success: false, message: 'Compte temporairement verrouillé. Réessayez dans 15 minutes.' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incLoginAttempts?.().catch(() => {});
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    await user.update({ loginAttempts: 0, lockUntil: null, lastLogin: new Date() });

    const token = generateToken(user.id);

    AuditLog.create({ action: 'USER_LOGIN', userId: user.id, ipAddress: req.ip || '127.0.0.1', userAgent: req.get('User-Agent') })
      .catch(e => console.warn('⚠️ Audit log:', e.message));

    logger.info('Connexion réussie', { userId: user.id, email: user.email });

    return res.json({
      success: true, message: 'Connexion réussie',
      data: {
        user: {
          id: user.id, uniqueCode: user.uniqueCode, email: user.email,
          firstName: user.firstName, lastName: user.lastName, role: user.role,
          gender: user.gender, dateOfBirth: user.dateOfBirth, phoneNumber: user.phoneNumber,
          bloodType: user.bloodType, specialty: user.specialty, licenseNumber: user.licenseNumber,
          biography: user.biography, languages: user.languages,
          isVerified: user.isVerified, profileCompleted: user.profileCompleted
        },
        token
      }
    });

  } catch (error) {
    console.error('❌ Erreur login:', error.message);
    logger.error('Erreur connexion', { error: error.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la connexion' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    console.log('\n📧 === FORGOT PASSWORD ===');
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email requis' });
    }

    // Réponse identique que l'email existe ou non (sécurité anti-énumération)
    const GENERIC_RESPONSE = {
      success: true,
      message: 'Si un compte avec cet email existe, un lien de réinitialisation a été envoyé.'
    };

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      console.log('📭 Email non trouvé – réponse générique envoyée');
      return res.json(GENERIC_RESPONSE);
    }

    // Générer un token sécurisé
    const resetToken  = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + RESET_EXPIRY);

    await user.update({ resetToken, resetTokenExpiry: resetExpiry });

    const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    console.log('🔗 Lien de reset:', resetLink);

    // Envoi de l'email via emailService
    try {
      await emailService.sendTemplate('forgotPassword', {
        firstName:     user.firstName,
        resetLink,
        expiryMinutes: RESET_EXPIRY_MINUTES
      }, user.email);
      console.log('✅ Email de réinitialisation envoyé à', user.email);
    } catch (emailErr) {
      // Ne pas bloquer la réponse si l'email échoue, mais loguer l'erreur
      console.error('❌ Échec envoi email reset:', emailErr.message);
      // On renvoie quand même la réponse générique pour ne pas révéler l'état
    }

    AuditLog.create({
      action: 'PASSWORD_RESET_REQUESTED', userId: user.id,
      ipAddress: req.ip || '127.0.0.1', userAgent: req.get('User-Agent')
    }).catch(e => console.warn('⚠️ Audit log:', e.message));

    return res.json(GENERIC_RESPONSE);

  } catch (error) {
    console.error('❌ Erreur forgot-password:', error.message);
    logger.error('Erreur forgot-password', { error: error.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    console.log('\n🔑 === RESET PASSWORD ===');
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token et nouveau mot de passe requis' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    // Chercher l'utilisateur avec un token valide et non expiré
    const user = await User.findOne({
      where: {
        resetToken:       token,
        resetTokenExpiry: { [Op.gt]: new Date() }  // token pas encore expiré
      }
    });

    if (!user) {
      console.log('❌ Token invalide ou expiré');
      return res.status(400).json({ success: false, message: 'Lien de réinitialisation invalide ou expiré. Faites une nouvelle demande.' });
    }

    // Mettre à jour le mot de passe et invalider le token
    // hooks: false car le beforeUpdate va hasher le mot de passe automatiquement
    await user.update({
      password,               // sera hashé par le hook beforeUpdate
      resetToken:        null,
      resetTokenExpiry:  null,
      loginAttempts:     0,
      lockUntil:         null,
      lastPasswordChange: new Date()
    });

    console.log('✅ Mot de passe réinitialisé pour', user.email);

    // Email de confirmation (non bloquant)
    emailService.sendTemplate('passwordChanged', { firstName: user.firstName }, user.email)
      .then(() => console.log('✅ Email confirmation changement envoyé'))
      .catch(err => console.warn('⚠️ Email confirmation:', err.message));

    AuditLog.create({
      action: 'PASSWORD_RESET_SUCCESS', userId: user.id,
      ipAddress: req.ip || '127.0.0.1', userAgent: req.get('User-Agent')
    }).catch(e => console.warn('⚠️ Audit log:', e.message));

    return res.json({ success: true, message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.' });

  } catch (error) {
    console.error('❌ Erreur reset-password:', error.message);
    logger.error('Erreur reset-password', { error: error.message });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────
const getCurrentUser = async (req, res) => {
  try {
    if (req.user.role === 'admin' || req.user.isAdmin) {
      return res.json({
        success: true,
        data: { user: { id: req.user.id, email: req.user.email, firstName: req.user.firstName || 'Admin', lastName: req.user.lastName || 'User', role: 'admin', uniqueCode: 'ADMIN', isVerified: true, isActive: true, profileCompleted: true } }
      });
    }

    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] }
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    return res.json({
      success: true,
      data: { user: { id: user.id, uniqueCode: user.uniqueCode, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, gender: user.gender, dateOfBirth: user.dateOfBirth, phoneNumber: user.phoneNumber, bloodType: user.bloodType, specialty: user.specialty, licenseNumber: user.licenseNumber, biography: user.biography, languages: user.languages, isVerified: user.isVerified, profileCompleted: user.profileCompleted, profilePicture: user.profilePicture } }
    });

  } catch (error) {
    console.error('❌ Erreur getCurrentUser:', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
const logout = async (req, res) => {
  AuditLog.create({ action: 'USER_LOGOUT', userId: req.user.id, ipAddress: req.ip || '127.0.0.1', userAgent: req.get('User-Agent') })
    .catch(e => console.warn('⚠️ Audit log:', e.message));

  return res.json({ success: true, message: 'Déconnexion réussie' });
};

module.exports = { register, login, forgotPassword, resetPassword, getCurrentUser, logout };
