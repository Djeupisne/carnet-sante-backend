const { Payment, Appointment, User, AuditLog } = require('../models');
const { validationService } = require('../services/validationService');
const { notificationService } = require('../services/notificationService');
const { Op } = require('sequelize');

exports.createPayment = async (req, res) => {
  try {
    const { appointmentId, amount, paymentMethod, metadata } = req.body;

    const validation = validationService.validatePayment(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Données de paiement invalides',
        errors: validation.errors
      });
    }

    const appointment = await Appointment.findByPk(appointmentId, {
      include: [
        { model: User, as: 'patient' },
        { model: User, as: 'doctor' }
      ]
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Rendez-vous non trouvé' });
    }

    if (req.user.role === 'patient' && appointment.patientId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Non autorisé à payer ce rendez-vous' });
    }

    const existingPayment = await Payment.findOne({ where: { appointmentId } });
    if (existingPayment) {
      return res.status(409).json({ success: false, message: 'Un paiement existe déjà pour ce rendez-vous' });
    }

    const commission = amount * 0.1;

    const payment = await Payment.create({
      appointmentId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      amount,
      commission,
      paymentMethod,
      metadata: metadata || {},
      transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5)}`.toUpperCase()
    });

    await AuditLog.create({
      action: 'PAYMENT_CREATED',
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { paymentId: payment.id, appointmentId, amount, paymentMethod }
    });

    await notificationService.createNotification({
      userId: appointment.patientId,
      type: 'payment_confirmation',
      title: 'Paiement initié',
      message: `Votre paiement de ${amount}€ pour le rendez-vous du ${new Date(appointment.appointmentDate).toLocaleDateString()} a été initié.`,
      data: { paymentId: payment.id, amount }
    });

    await notificationService.createNotification({
      userId: appointment.doctorId,
      type: 'payment_confirmation',
      title: 'Paiement patient',
      message: `Le patient ${appointment.patient.firstName} ${appointment.patient.lastName} a initié le paiement pour le rendez-vous.`,
      data: { paymentId: payment.id, amount }
    });

    res.status(201).json({
      success: true,
      message: 'Paiement créé avec succès',
      data: { payment }
    });

  } catch (error) {
    console.error('Erreur lors de la création du paiement:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
};

exports.processPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status, transactionDetails } = req.body;

    const payment = await Payment.findByPk(paymentId, {
      include: [
        {
          model: Appointment,
          as: 'appointment',
          include: [
            { model: User, as: 'patient' },
            { model: User, as: 'doctor' }
          ]
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Paiement non trouvé' });
    }

    await payment.update({
      status,
      paymentDate: status === 'completed' ? new Date() : null,
      metadata: {
        ...payment.metadata,
        transactionDetails,
        processedAt: new Date().toISOString()
      }
    });

    if (status === 'completed') {
      await payment.appointment.update({ status: 'confirmed' });
    }

    await AuditLog.create({
      action: 'PAYMENT_PROCESSED',
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: {
        paymentId,
        oldStatus: payment.status,
        newStatus: status
      }
    });

    const notificationMessage = status === 'completed'
      ? `Votre paiement de ${payment.amount}€ a été confirmé.`
      : `Votre paiement de ${payment.amount}€ a échoué.`;

    await notificationService.createNotification({
      userId: payment.patientId,
      type: 'payment_confirmation',
      title: status === 'completed' ? 'Paiement confirmé' : 'Paiement échoué',
      message: notificationMessage,
      data: { paymentId: payment.id, status }
    });

    res.json({
      success: true,
      message: `Paiement ${status} avec succès`,
      data: { payment }
    });

  } catch (error) {
    console.error('Erreur lors du traitement du paiement:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
};

exports.getPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    const whereClause = {};
    if (userRole === 'patient') {
      whereClause.patientId = userId;
    } else if (userRole === 'doctor') {
      whereClause.doctorId = userId;
    }

    if (status) {
      whereClause.status = status;
    }

    const offset = (page - 1) * limit;

    const { count, rows: payments } = await Payment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Appointment,
          as: 'appointment',
          attributes: ['id', 'appointmentDate', 'reason', 'type']
        },
        {
          model: User,
          as: userRole === 'patient' ? 'doctor' : 'patient',
          attributes: ['id', 'firstName', 'lastName']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(count / limit),
          totalRecords: count
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique des paiements:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
};

exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findByPk(id, {
      include: [
        { model: Appointment, as: 'appointment' },
        { model: User, as: 'patient' },
        { model: User, as: 'doctor' }
      ]
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Paiement non trouvé' });
    }

    if (
      req.user.role === 'patient' && payment.patientId !== req.user.id ||
      req.user.role === 'doctor' && payment.doctorId !== req.user.id
    ) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    console.error('Erreur lors de la récupération du paiement:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
};

exports.refundPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findByPk(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Paiement non trouvé' });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Seuls les paiements complétés peuvent être remboursés' });
    }

    await payment.update({ status: 'refunded' });

    await AuditLog.create({
      action: 'PAYMENT_REFUNDED',
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { paymentId: id }
    });

    await notificationService.createNotification({
      userId: payment.patientId,
      type: 'payment_refund',
      title: 'Paiement remboursé',
      message: `Votre paiement de ${payment.amount}€ a été remboursé.`,
      data: { paymentId: payment.id }
    });

    res.json({
      success: true,
      message: 'Paiement remboursé avec succès',
      data: { payment }
    });

  } catch (error) {
    console.error('Erreur lors du remboursement du paiement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};