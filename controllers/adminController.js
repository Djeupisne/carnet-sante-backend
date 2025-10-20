const { User, Appointment, Payment, MedicalFile, AuditLog } = require('../models');
const { Op } = require('sequelize');
const { validationService } = require('../services/validationService');
const { sequelize } = require('../config/database');
exports.getDashboardStats = async (req, res) => {
  try {
    // Statistiques générales
    const totalUsers = await User.count();
    const totalDoctors = await User.count({ where: { role: 'doctor' } });
    const totalPatients = await User.count({ where: { role: 'patient' } });
    const totalAppointments = await Appointment.count();
    const totalRevenue = await Payment.sum('amount', { 
      where: { status: 'completed' } 
    });
    const totalCommission = await Payment.sum('commission', {
      where: { status: 'completed' }
    });

    // Rendez-vous par statut
    const appointmentsByStatus = await Appointment.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    // Revenus mensuels
    const monthlyRevenue = await Payment.findAll({
      attributes: [
        [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('paymentDate')), 'month'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'revenue'],
        [sequelize.fn('SUM', sequelize.col('commission')), 'commission']
      ],
      where: {
        status: 'completed',
        paymentDate: {
          [Op.gte]: new Date(new Date().getFullYear(), 0, 1) // Depuis début d'année
        }
      },
      group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('paymentDate'))],
      order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('paymentDate')), 'ASC']]
    });

    const stats = {
      users: {
        total: totalUsers,
        doctors: totalDoctors,
        patients: totalPatients
      },
      appointments: {
        total: totalAppointments,
        byStatus: appointmentsByStatus.reduce((acc, item) => {
          acc[item.status] = parseInt(item.get('count'));
          return acc;
        }, {})
      },
      financial: {
        totalRevenue: totalRevenue || 0,
        totalCommission: totalCommission || 0,
        monthlyRevenue
      }
    };

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search, isActive } = req.query;

    const whereClause = {};
    if (role) whereClause.role = role;
    if (isActive !== undefined) whereClause.isActive = isActive === 'true';
    if (search) {
      whereClause[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { uniqueCode: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(count / limit),
          totalRecords: count
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    await user.update({ isActive });

    // Log d'audit
    await AuditLog.create({
      action: 'USER_STATUS_UPDATED',
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: {
        targetUserId: userId,
        isActive
      }
    });

    res.json({
      success: true,
      message: `Utilisateur ${isActive ? 'activé' : 'désactivé'} avec succès`
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, userId, startDate, endDate } = req.query;

    const whereClause = {};
    if (action) whereClause.action = action;
    if (userId) whereClause.userId = userId;
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate);
    }

    const offset = (page - 1) * limit;

    const { count, rows: logs } = await AuditLog.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(count / limit),
          totalRecords: count
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des logs d\'audit:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

// Ajoutez cette méthode manquante
exports.getFinancialReports = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'month' } = req.query;

    const whereClause = {
      status: 'completed'
    };

    if (startDate || endDate) {
      whereClause.paymentDate = {};
      if (startDate) whereClause.paymentDate[Op.gte] = new Date(startDate);
      if (endDate) whereClause.paymentDate[Op.lte] = new Date(endDate);
    }

    let groupByClause;
    switch (groupBy) {
      case 'day':
        groupByClause = sequelize.fn('DATE', sequelize.col('paymentDate'));
        break;
      case 'week':
        groupByClause = sequelize.fn('DATE_TRUNC', 'week', sequelize.col('paymentDate'));
        break;
      case 'month':
      default:
        groupByClause = sequelize.fn('DATE_TRUNC', 'month', sequelize.col('paymentDate'));
        break;
    }

    const financialData = await Payment.findAll({
      attributes: [
        [groupByClause, 'period'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalRevenue'],
        [sequelize.fn('SUM', sequelize.col('commission')), 'totalCommission'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'transactionCount']
      ],
      where: whereClause,
      group: ['period'],
      order: [['period', 'ASC']]
    });

    // Statistiques par méthode de paiement
    const paymentMethods = await Payment.findAll({
      attributes: [
        'paymentMethod',
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'transactionCount']
      ],
      where: whereClause,
      group: ['paymentMethod']
    });

    res.json({
      success: true,
      data: {
        financialData,
        paymentMethods,
        period: {
          startDate: startDate || 'début',
          endDate: endDate || 'maintenant',
          groupBy
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la génération des rapports financiers:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};