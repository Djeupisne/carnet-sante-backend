const { User, Appointment, Payment, AuditLog, sequelize } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const { validationService } = require('../services/validationService');

const adminController = {
  // ============================================
  // DASHBOARD
  // ============================================
  async getDashboardStats(req, res) {
    try {
      console.log('📊 Récupération des statistiques dashboard admin...');

      // Statistiques utilisateurs
      const totalDoctors = await User.count({ where: { role: 'doctor' } });
      const totalPatients = await User.count({ where: { role: 'patient' } });
      const totalAdmins = await User.count({ where: { role: 'admin' } });
      const activeUsers = await User.count({ where: { isActive: true } });
      const inactiveUsers = await User.count({ where: { isActive: false } });

      // Statistiques rendez-vous
      const totalAppointments = await Appointment.count();
      const pendingAppointments = await Appointment.count({ where: { status: 'pending' } });
      const confirmedAppointments = await Appointment.count({ where: { status: 'confirmed' } });
      const completedAppointments = await Appointment.count({ where: { status: 'completed' } });
      const cancelledAppointments = await Appointment.count({ where: { status: 'cancelled' } });

      // Rendez-vous du jour
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayAppointments = await Appointment.count({
        where: {
          appointmentDate: {
            [Op.between]: [today, tomorrow]
          }
        }
      });

      // Rendez-vous de la semaine
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekAppointments = await Appointment.count({
        where: {
          appointmentDate: {
            [Op.between]: [weekStart, weekEnd]
          }
        }
      });

      // Rendez-vous du mois
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const monthAppointments = await Appointment.count({
        where: {
          appointmentDate: {
            [Op.between]: [monthStart, monthEnd]
          }
        }
      });

      // Statistiques financières
      const totalRevenue = await Payment.sum('amount', {
        where: { status: 'completed' }
      }) || 0;

      const pendingPayments = await Payment.sum('amount', {
        where: { status: 'pending' }
      }) || 0;

      // Commission (10%)
      const totalCommission = totalRevenue * 0.1;

      // Activités récentes
      const recentAppointments = await Appointment.findAll({
        limit: 10,
        order: [['createdAt', 'DESC']],
        include: [
          { model: User, as: 'patient', attributes: ['firstName', 'lastName'] },
          { model: User, as: 'doctor', attributes: ['firstName', 'lastName'] }
        ]
      });

      const recentActivities = recentAppointments.map(apt => ({
        id: apt.id,
        type: 'appointment',
        description: `Rendez-vous: ${apt.patient?.firstName} ${apt.patient?.lastName} avec Dr. ${apt.doctor?.firstName} ${apt.doctor?.lastName}`,
        timestamp: apt.createdAt,
        status: apt.status
      }));

      // Derniers utilisateurs inscrits
      const recentUsers = await User.findAll({
        limit: 5,
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'createdAt']
      });

      res.json({
        success: true,
        data: {
          users: {
            total: totalDoctors + totalPatients + totalAdmins,
            doctors: totalDoctors,
            patients: totalPatients,
            admins: totalAdmins,
            active: activeUsers,
            inactive: inactiveUsers,
            recent: recentUsers
          },
          appointments: {
            total: totalAppointments,
            pending: pendingAppointments,
            confirmed: confirmedAppointments,
            completed: completedAppointments,
            cancelled: cancelledAppointments,
            today: todayAppointments,
            thisWeek: weekAppointments,
            thisMonth: monthAppointments
          },
          financial: {
            totalRevenue,
            totalCommission,
            pendingPayments,
            completedPayments: totalRevenue - pendingPayments
          },
          recentActivities
        }
      });

    } catch (error) {
      console.error('❌ Erreur getDashboardStats:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  },

  // ============================================
  // GESTION DES UTILISATEURS (CRUD COMPLET)
  // ============================================
  async getUsers(req, res) {
    try {
      const { 
        role, 
        isActive, 
        search, 
        page = 1, 
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = req.query;

      console.log('👥 Récupération des utilisateurs avec filtres:', { role, isActive, search });

      const whereClause = {};
      if (role) whereClause.role = role;
      if (isActive !== undefined) whereClause.isActive = isActive === 'true';
      
      if (search) {
        whereClause[Op.or] = [
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
          { phoneNumber: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows } = await User.findAndCountAll({
        where: whereClause,
        attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] },
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [[sortBy, sortOrder]]
      });

      // Audit log
      await AuditLog.create({
        action: 'ADMIN_VIEW_USERS',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: { filters: { role, isActive, search }, count }
      });

      res.json({
        success: true,
        data: rows,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(count / limit),
          totalRecords: count,
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('❌ Erreur getUsers:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des utilisateurs'
      });
    }
  },

  async getUserById(req, res) {
    try {
      const { id } = req.params;

      console.log(`👤 Récupération de l'utilisateur ${id}...`);

      const user = await User.findByPk(id, {
        attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] },
        include: [
          {
            model: Appointment,
            as: 'patientAppointments',
            limit: 5,
            order: [['appointmentDate', 'DESC']],
            include: [{ model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName'] }]
          },
          {
            model: Appointment,
            as: 'doctorAppointments',
            limit: 5,
            order: [['appointmentDate', 'DESC']],
            include: [{ model: User, as: 'patient', attributes: ['id', 'firstName', 'lastName'] }]
          }
        ]
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Audit log
      await AuditLog.create({
        action: 'ADMIN_VIEW_USER',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: { targetUserId: id }
      });

      res.json({
        success: true,
        data: user
      });

    } catch (error) {
      console.error('❌ Erreur getUserById:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de l\'utilisateur'
      });
    }
  },

  async createUser(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const userData = req.body;

      console.log('📝 Création d\'un nouvel utilisateur par admin:', userData.email);

      // Validation
      if (!userData.email || !userData.password || !userData.firstName || !userData.lastName || !userData.role) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Champs obligatoires manquants'
        });
      }

      // Vérifier si l'email existe déjà
      const existingUser = await User.findOne({ 
        where: { email: userData.email },
        transaction 
      });
      
      if (existingUser) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé'
        });
      }

      // Hasher le mot de passe
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Créer l'utilisateur
      const user = await User.create({
        ...userData,
        password: hashedPassword,
        isVerified: true,
        uniqueCode: userData.role === 'patient' ? 'PAT-' + Date.now() : 'DOC-' + Date.now()
      }, { transaction });

      // Audit log
      await AuditLog.create({
        action: 'ADMIN_CREATE_USER',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: { 
          createdUserId: user.id,
          role: user.role,
          email: user.email
        }
      }, { transaction });

      await transaction.commit();

      res.status(201).json({
        success: true,
        data: user,
        message: 'Utilisateur créé avec succès'
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Erreur createUser:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création de l\'utilisateur'
      });
    }
  },

  async updateUser(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const userData = req.body;

      console.log(`📝 Mise à jour de l'utilisateur ${id} par admin...`);

      const user = await User.findByPk(id, { transaction });

      if (!user) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Si le mot de passe est fourni, le hasher
      if (userData.password) {
        const salt = await bcrypt.genSalt(10);
        userData.password = await bcrypt.hash(userData.password, salt);
      }

      // Ne pas permettre de changer l'email si déjà utilisé
      if (userData.email && userData.email !== user.email) {
        const existingUser = await User.findOne({ 
          where: { email: userData.email },
          transaction 
        });
        if (existingUser) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'Cet email est déjà utilisé'
          });
        }
      }

      await user.update(userData, { transaction });

      // Audit log
      await AuditLog.create({
        action: 'ADMIN_UPDATE_USER',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: { 
          targetUserId: id,
          updatedFields: Object.keys(userData)
        }
      }, { transaction });

      await transaction.commit();

      res.json({
        success: true,
        data: user,
        message: 'Utilisateur mis à jour avec succès'
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Erreur updateUser:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour de l\'utilisateur'
      });
    }
  },

  async deleteUser(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;

      console.log(`🗑️ Suppression de l'utilisateur ${id} par admin...`);

      const user = await User.findByPk(id, { transaction });

      if (!user) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Empêcher la suppression d'un admin
      if (user.role === 'admin') {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: 'Impossible de supprimer un administrateur'
        });
      }

      // Supprimer les rendez-vous associés
      await Appointment.destroy({ 
        where: { 
          [Op.or]: [
            { patientId: id },
            { doctorId: id }
          ]
        },
        transaction 
      });

      // Supprimer les paiements associés
      await Payment.destroy({ 
        where: { userId: id },
        transaction 
      });

      // Audit log avant suppression
      await AuditLog.create({
        action: 'ADMIN_DELETE_USER',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: { 
          deletedUserId: id,
          role: user.role,
          email: user.email
        }
      }, { transaction });

      // Supprimer l'utilisateur
      await user.destroy({ transaction });

      await transaction.commit();

      res.json({
        success: true,
        message: 'Utilisateur supprimé avec succès'
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Erreur deleteUser:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression de l\'utilisateur'
      });
    }
  },

  async toggleUserStatus(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;

      console.log(`🔄 Changement de statut de l'utilisateur ${id}...`);

      const user = await User.findByPk(id, { transaction });

      if (!user) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Empêcher la désactivation d'un admin
      if (user.role === 'admin' && user.isActive) {
        const adminCount = await User.count({ 
          where: { role: 'admin', isActive: true },
          transaction 
        });
        
        if (adminCount <= 1) {
          await transaction.rollback();
          return res.status(403).json({
            success: false,
            message: 'Impossible de désactiver le dernier administrateur actif'
          });
        }
      }

      await user.update({ isActive: !user.isActive }, { transaction });

      // Audit log
      await AuditLog.create({
        action: 'ADMIN_TOGGLE_USER_STATUS',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: { 
          targetUserId: id,
          newStatus: user.isActive
        }
      }, { transaction });

      await transaction.commit();

      res.json({
        success: true,
        data: user,
        message: `Utilisateur ${user.isActive ? 'activé' : 'désactivé'} avec succès`
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Erreur toggleUserStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du changement de statut'
      });
    }
  },

  // Garder l'ancienne méthode pour compatibilité
  async updateUserStatus(req, res) {
    return this.toggleUserStatus(req, res);
  },

  // ============================================
  // GESTION DES RENDEZ-VOUS
  // ============================================
  async getAllAppointments(req, res) {
    try {
      const { 
        status, 
        startDate, 
        endDate, 
        doctorId, 
        patientId,
        page = 1, 
        limit = 20 
      } = req.query;

      console.log('📋 Récupération de tous les rendez-vous par admin...');

      const whereClause = {};
      if (status) whereClause.status = status;
      if (doctorId) whereClause.doctorId = doctorId;
      if (patientId) whereClause.patientId = patientId;
      
      if (startDate && endDate) {
        whereClause.appointmentDate = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      const offset = (page - 1) * limit;

      const { count, rows } = await Appointment.findAndCountAll({
        where: whereClause,
        include: [
          { model: User, as: 'patient', attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'] },
          { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName', 'email', 'specialty'] },
          { model: Payment, as: 'payment' }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['appointmentDate', 'DESC']]
      });

      // Audit log
      await AuditLog.create({
        action: 'ADMIN_VIEW_APPOINTMENTS',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: { filters: { status, startDate, endDate }, count }
      });

      res.json({
        success: true,
        data: rows,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(count / limit),
          totalRecords: count
        }
      });

    } catch (error) {
      console.error('❌ Erreur getAllAppointments:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des rendez-vous'
      });
    }
  },

  async getAppointmentById(req, res) {
    try {
      const { id } = req.params;

      console.log(`📋 Récupération du rendez-vous ${id} par admin...`);

      const appointment = await Appointment.findByPk(id, {
        include: [
          { model: User, as: 'patient', attributes: { exclude: ['password'] } },
          { model: User, as: 'doctor', attributes: { exclude: ['password'] } },
          { model: Payment, as: 'payment' }
        ]
      });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Rendez-vous non trouvé'
        });
      }

      // Audit log
      await AuditLog.create({
        action: 'ADMIN_VIEW_APPOINTMENT',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: { appointmentId: id }
      });

      res.json({
        success: true,
        data: appointment
      });

    } catch (error) {
      console.error('❌ Erreur getAppointmentById:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du rendez-vous'
      });
    }
  },

  async deleteAppointment(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;

      console.log(`🗑️ Suppression du rendez-vous ${id} par admin...`);

      const appointment = await Appointment.findByPk(id, { transaction });

      if (!appointment) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Rendez-vous non trouvé'
        });
      }

      // Supprimer le paiement associé
      await Payment.destroy({ 
        where: { appointmentId: id },
        transaction 
      });

      // Audit log
      await AuditLog.create({
        action: 'ADMIN_DELETE_APPOINTMENT',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: { 
          appointmentId: id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId
        }
      }, { transaction });

      await appointment.destroy({ transaction });

      await transaction.commit();

      res.json({
        success: true,
        message: 'Rendez-vous supprimé avec succès'
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Erreur deleteAppointment:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression du rendez-vous'
      });
    }
  },

  // ============================================
  // RAPPORTS FINANCIERS
  // ============================================
  async getFinancialReports(req, res) {
    try {
      const { startDate, endDate, doctorId } = req.query;

      console.log('💰 Récupération des rapports financiers...');

      const whereClause = { status: 'completed' };
      
      if (startDate && endDate) {
        whereClause.createdAt = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      const payments = await Payment.findAll({
        where: whereClause,
        include: [
          { 
            model: Appointment,
            include: [
              { model: User, as: 'doctor', attributes: ['id', 'firstName', 'lastName'] },
              { model: User, as: 'patient', attributes: ['id', 'firstName', 'lastName'] }
            ]
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // Filtrer par médecin si spécifié
      let filteredPayments = payments;
      if (doctorId) {
        filteredPayments = payments.filter(p => p.Appointment?.doctorId === doctorId);
      }

      const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
      const totalCommission = totalRevenue * 0.1;

      // Statistiques par médecin
      const doctorStats = {};
      filteredPayments.forEach(payment => {
        const doctorId = payment.Appointment?.doctorId;
        const doctorName = payment.Appointment?.doctor ? 
          `${payment.Appointment.doctor.firstName} ${payment.Appointment.doctor.lastName}` : 
          'Inconnu';

        if (!doctorStats[doctorId]) {
          doctorStats[doctorId] = {
            doctorId,
            doctorName,
            total: 0,
            count: 0,
            average: 0
          };
        }

        doctorStats[doctorId].total += payment.amount;
        doctorStats[doctorId].count += 1;
      });

      // Calculer les moyennes
      Object.values(doctorStats).forEach(stat => {
        stat.average = stat.total / stat.count;
      });

      // Audit log
      await AuditLog.create({
        action: 'ADMIN_VIEW_FINANCIAL_REPORTS',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: { startDate, endDate, doctorId }
      });

      res.json({
        success: true,
        data: {
          summary: {
            totalRevenue,
            totalCommission,
            netRevenue: totalRevenue - totalCommission,
            totalTransactions: filteredPayments.length,
            averageTransaction: filteredPayments.length ? totalRevenue / filteredPayments.length : 0
          },
          byDoctor: Object.values(doctorStats),
          payments: filteredPayments
        }
      });

    } catch (error) {
      console.error('❌ Erreur getFinancialReports:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des rapports financiers'
      });
    }
  },

  async getDoctorFinancialStats(req, res) {
    try {
      console.log('💰 Récupération des statistiques financières par médecin...');

      const doctors = await User.findAll({
        where: { role: 'doctor', isActive: true },
        attributes: ['id', 'firstName', 'lastName', 'specialty']
      });

      const stats = await Promise.all(doctors.map(async (doctor) => {
        const payments = await Payment.findAll({
          where: { status: 'completed' },
          include: [{
            model: Appointment,
            where: { doctorId: doctor.id },
            required: true
          }]
        });

        const total = payments.reduce((sum, p) => sum + p.amount, 0);
        const appointments = await Appointment.count({ where: { doctorId: doctor.id } });
        const completedAppointments = await Appointment.count({ 
          where: { doctorId: doctor.id, status: 'completed' } 
        });

        return {
          doctorId: doctor.id,
          doctorName: `${doctor.firstName} ${doctor.lastName}`,
          specialty: doctor.specialty,
          totalRevenue: total,
          commission: total * 0.1,
          netRevenue: total * 0.9,
          totalAppointments: appointments,
          completedAppointments,
          averagePerAppointment: appointments ? total / appointments : 0
        };
      }));

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('❌ Erreur getDoctorFinancialStats:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques par médecin'
      });
    }
  },

  // ============================================
  // AUDIT LOGS
  // ============================================
  async getAuditLogs(req, res) {
    try {
      const { 
        action, 
        userId, 
        startDate, 
        endDate, 
        page = 1, 
        limit = 50 
      } = req.query;

      console.log('📋 Récupération des logs d\'audit...');

      const whereClause = {};
      if (action) whereClause.action = action;
      if (userId) whereClause.userId = userId;
      
      if (startDate && endDate) {
        whereClause.createdAt = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      const offset = (page - 1) * limit;

      const { count, rows } = await AuditLog.findAndCountAll({
        where: whereClause,
        include: [{
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email', 'role']
        }],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: rows,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(count / limit),
          totalRecords: count
        }
      });

    } catch (error) {
      console.error('❌ Erreur getAuditLogs:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des logs d\'audit'
      });
    }
  },

  async getUserAuditLogs(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      console.log(`📋 Récupération des logs d'audit pour l'utilisateur ${userId}...`);

      const offset = (page - 1) * limit;

      const { count, rows } = await AuditLog.findAndCountAll({
        where: { userId },
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: rows,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(count / limit),
          totalRecords: count
        }
      });

    } catch (error) {
      console.error('❌ Erreur getUserAuditLogs:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des logs d\'audit'
      });
    }
  }
};

module.exports = adminController;
