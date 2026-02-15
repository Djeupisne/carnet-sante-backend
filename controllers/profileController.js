const { Op } = require('sequelize');
const { User, MedicalFile, Appointment, AuditLog } = require('../models');
const { validationService } = require('../services/validationService');
const { encryptionService } = require('../services/encryptionService');
const fs = require('fs');
const path = require('path');

// ============================================
// MÉTHODES EXISTANTES
// ============================================

exports.getProfile = async (req, res) => {
  try {
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
      data: { user }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    const userId = req.user.id;

    // Validation des données
    const validation = validationService.validateProfileUpdate(updates);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Données de mise à jour invalides',
        errors: validation.errors
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Empêcher la modification du rôle et de l'email
    if (updates.role || updates.email) {
      return res.status(403).json({
        success: false,
        message: 'Modification du rôle ou de l\'email non autorisée'
      });
    }

    await user.update(updates);

    // Log d'audit
    await AuditLog.create({
      action: 'PROFILE_UPDATED',
      userId: userId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { updates }
    });

    // Retourner l'utilisateur mis à jour sans le mot de passe
    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] }
    });

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel et nouveau mot de passe requis'
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Vérifier le mot de passe actuel
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel incorrect'
      });
    }

    // Validation du nouveau mot de passe
    const passwordValidation = validationService.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Nouveau mot de passe invalide',
        errors: passwordValidation.errors
      });
    }

    // Mettre à jour le mot de passe
    await user.update({ password: newPassword });

    // Log d'audit
    await AuditLog.create({
      action: 'PASSWORD_CHANGED',
      userId: userId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });

  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let stats = {};

    if (userRole === 'patient') {
      const totalAppointments = await Appointment.count({
        where: { patientId: userId }
      });

      const upcomingAppointments = await Appointment.count({
        where: {
          patientId: userId,
          status: 'confirmed',
          appointmentDate: { [Op.gte]: new Date() }
        }
      });

      const medicalFiles = await MedicalFile.count({
        where: { patientId: userId }
      });

      stats = {
        totalAppointments,
        upcomingAppointments,
        medicalFiles
      };

    } else if (userRole === 'doctor') {
      const totalAppointments = await Appointment.count({
        where: { doctorId: userId }
      });

      const todayAppointments = await Appointment.count({
        where: {
          doctorId: userId,
          status: 'confirmed',
          appointmentDate: {
            [Op.gte]: new Date().setHours(0, 0, 0, 0),
            [Op.lt]: new Date().setHours(23, 59, 59, 999)
          }
        }
      });

      const totalPatients = await Appointment.count({
        where: { doctorId: userId },
        distinct: true,
        col: 'patientId'
      });

      stats = {
        totalAppointments,
        todayAppointments,
        totalPatients
      };
    }

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

// ============================================
// ✅ NOUVELLES MÉTHODES POUR LES PRÉFÉRENCES
// ============================================

/**
 * GET /api/profile/preferences
 * Récupérer les préférences de l'utilisateur
 */
exports.getPreferences = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    // Préférences par défaut
    const defaultPreferences = {
      language: 'fr',
      theme: 'dark',
      notifications: {
        email: true,
        sms: false,
        push: true
      }
    };

    res.json({
      success: true,
      data: user.preferences || defaultPreferences
    });

  } catch (error) {
    console.error('❌ Erreur getPreferences:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des préférences'
    });
  }
};

/**
 * PATCH /api/profile/preferences
 * Mettre à jour les préférences de l'utilisateur
 */
exports.updatePreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    const user = await User.findByPk(req.user.id);

    // Validation basique
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Données de préférences invalides'
      });
    }

    await user.update({ preferences });

    // Log d'audit
    await AuditLog.create({
      action: 'PREFERENCES_UPDATED',
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { preferences }
    });

    res.json({
      success: true,
      data: user,
      message: 'Préférences mises à jour avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur updatePreferences:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des préférences'
    });
  }
};

// ============================================
// ✅ NOUVELLES MÉTHODES POUR LA PHOTO DE PROFIL
// ============================================

/**
 * POST /api/profile/picture
 * Uploader une photo de profil
 */
exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier uploadé'
      });
    }

    const profilePicture = `/uploads/profiles/${req.file.filename}`;
    const user = await User.findByPk(req.user.id);

    // Supprimer l'ancienne photo si elle existe
    if (user.profilePicture) {
      const oldPath = path.join(__dirname, '..', user.profilePicture);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await user.update({ profilePicture });

    // Log d'audit
    await AuditLog.create({
      action: 'PROFILE_PICTURE_UPDATED',
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: { profilePicture },
      message: 'Photo de profil mise à jour avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur uploadProfilePicture:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload de la photo'
    });
  }
};

/**
 * DELETE /api/profile/picture
 * Supprimer la photo de profil
 */
exports.deleteProfilePicture = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (user.profilePicture) {
      const filePath = path.join(__dirname, '..', user.profilePicture);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await user.update({ profilePicture: null });

    // Log d'audit
    await AuditLog.create({
      action: 'PROFILE_PICTURE_DELETED',
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Photo de profil supprimée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur deleteProfilePicture:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la photo'
    });
  }
};

// ============================================
// ✅ NOUVELLES MÉTHODES POUR LE CONTACT D'URGENCE
// ============================================

/**
 * GET /api/profile/emergency-contact
 * Récupérer le contact d'urgence
 */
exports.getEmergencyContact = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    res.json({
      success: true,
      data: user.emergencyContact || {
        name: '',
        phone: '',
        relationship: ''
      }
    });

  } catch (error) {
    console.error('❌ Erreur getEmergencyContact:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du contact d\'urgence'
    });
  }
};

/**
 * PUT /api/profile/emergency-contact
 * Mettre à jour le contact d'urgence
 */
exports.updateEmergencyContact = async (req, res) => {
  try {
    const { name, phone, relationship } = req.body;
    const user = await User.findByPk(req.user.id);

    // Validation simple
    if (!name || !phone || !relationship) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs du contact d\'urgence sont requis'
      });
    }

    await user.update({
      emergencyContact: { name, phone, relationship }
    });

    // Log d'audit
    await AuditLog.create({
      action: 'EMERGENCY_CONTACT_UPDATED',
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { name, phone, relationship }
    });

    res.json({
      success: true,
      data: user,
      message: 'Contact d\'urgence mis à jour avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur updateEmergencyContact:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du contact d\'urgence'
    });
  }
};

// ============================================
// ✅ NOUVELLES MÉTHODES POUR L'HISTORIQUE ET EXPORT
// ============================================

/**
 * GET /api/profile/login-history
 * Récupérer l'historique des connexions
 */
exports.getLoginHistory = async (req, res) => {
  try {
    const logs = await AuditLog.findAll({
      where: {
        userId: req.user.id,
        action: {
          [Op.in]: ['USER_LOGIN', 'ADMIN_LOGIN', 'PASSWORD_CHANGED']
        }
      },
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.json({
      success: true,
      data: logs
    });

  } catch (error) {
    console.error('❌ Erreur getLoginHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique'
    });
  }
};

/**
 * POST /api/profile/deactivate
 * Désactiver le compte
 */
exports.deactivateAccount = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    await user.update({ isActive: false });

    // Log d'audit
    await AuditLog.create({
      action: 'ACCOUNT_DEACTIVATED',
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Compte désactivé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur deactivateAccount:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la désactivation du compte'
    });
  }
};

/**
 * GET /api/profile/export-data
 * Exporter toutes les données personnelles
 */
exports.exportPersonalData = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] }
    });

    const appointments = await Appointment.findAll({
      where: { patientId: req.user.id },
      include: [
        { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName', 'specialty'] }
      ],
      order: [['appointmentDate', 'DESC']]
    });

    const medicalFiles = await MedicalFile.findAll({
      where: { patientId: req.user.id },
      include: [
        { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName'] }
      ],
      order: [['consultationDate', 'DESC']]
    });

    const auditLogs = await AuditLog.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    const exportData = {
      user: {
        id: user.id,
        uniqueCode: user.uniqueCode,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
        address: user.address,
        bloodType: user.bloodType,
        emergencyContact: user.emergencyContact,
        preferences: user.preferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      appointments: appointments.map(apt => ({
        id: apt.id,
        date: apt.appointmentDate,
        doctor: apt.doctor ? `${apt.doctor.firstName} ${apt.doctor.lastName}` : null,
        specialty: apt.doctor?.specialty,
        status: apt.status,
        reason: apt.reason,
        type: apt.type,
        createdAt: apt.createdAt
      })),
      medicalFiles: medicalFiles.map(file => ({
        id: file.id,
        type: file.recordType,
        title: file.title,
        description: file.description,
        diagnosis: file.diagnosis,
        date: file.consultationDate,
        doctor: file.doctor ? `${file.doctor.firstName} ${file.doctor.lastName}` : null,
        createdAt: file.createdAt
      })),
      auditLogs: auditLogs.map(log => ({
        action: log.action,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt
      })),
      exportDate: new Date().toISOString()
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=user-data-${user.id}-${Date.now()}.json`);
    res.send(JSON.stringify(exportData, null, 2));

  } catch (error) {
    console.error('❌ Erreur exportPersonalData:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export des données'
    });
  }
};
