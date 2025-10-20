const { User, MedicalFile, Appointment, AuditLog } = require('../models');
const { validationService } = require('../services/validationService');
const { encryptionService } = require('../services/encryptionService');

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