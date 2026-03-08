// controllers/adminExtendedController.js
const { Prescription, VideoCall, DoctorPayment, User, Appointment } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../utils/logger');

const DOCTOR_INCLUDE = { model: User, as: 'doctor',  attributes: ['id','firstName','lastName','email','specialty','phoneNumber'] };
const PATIENT_INCLUDE = { model: User, as: 'patient', attributes: ['id','firstName','lastName','email','phoneNumber'] };

// ══════════════════════════════════════════════
// PRESCRIPTIONS (vue admin — toutes)
// ══════════════════════════════════════════════

exports.getAllPrescriptions = async (req, res) => {
  try {
    const { status, doctorId, patientId, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status)   where.status   = status;
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Prescription.findAndCountAll({
      where,
      include: [DOCTOR_INCLUDE, PATIENT_INCLUDE],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) }
    });
  } catch (error) {
    logger.error('getAllPrescriptions (admin):', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ══════════════════════════════════════════════
// APPELS VIDÉO (vue admin — tous)
// ══════════════════════════════════════════════

exports.getAllVideoCalls = async (req, res) => {
  try {
    const { status, doctorId, patientId, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status)   where.status   = status;
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await VideoCall.findAndCountAll({
      where,
      include: [DOCTOR_INCLUDE, PATIENT_INCLUDE],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) }
    });
  } catch (error) {
    logger.error('getAllVideoCalls (admin):', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ══════════════════════════════════════════════
// PAIEMENTS MÉDECINS
// ══════════════════════════════════════════════

// GET /api/admin/doctor-payments — liste tous les paiements
exports.getDoctorPayments = async (req, res) => {
  try {
    const { status, doctorId, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status)   where.status   = status;
    if (doctorId) where.doctorId = doctorId;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await DoctorPayment.findAndCountAll({
      where,
      include: [
        DOCTOR_INCLUDE,
        { model: User, as: 'processor', attributes: ['id','firstName','lastName'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) }
    });
  } catch (error) {
    logger.error('getDoctorPayments:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/admin/doctor-earnings — revenus calculés par médecin
exports.getDoctorEarnings = async (req, res) => {
  try {
    const doctors = await User.findAll({
      where: { role: 'doctor', isActive: true },
      attributes: ['id','firstName','lastName','email','specialty','consultationPrice','phoneNumber']
    });

    const earnings = await Promise.all(doctors.map(async (doctor) => {
      // Consultations terminées
      const completedAppointments = await Appointment.count({
        where: { doctorId: doctor.id, status: 'completed' }
      });

      // Paiements déjà versés
      const paidPayments = await DoctorPayment.findAll({
        where: { doctorId: doctor.id, status: 'completed' },
        attributes: ['amount', 'consultationsCount', 'period', 'processedAt', 'paymentMethod']
      });

      const totalPaid = paidPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const paidConsultations = paidPayments.reduce((sum, p) => sum + (p.consultationsCount || 0), 0);
      const unpaidConsultations = completedAppointments - paidConsultations;
      const price = parseFloat(doctor.consultationPrice || 0);
      const totalEarned = completedAppointments * price;
      // Plateforme prend 10%
      const doctorShare = totalEarned * 0.9;
      const amountDue = unpaidConsultations * price * 0.9;

      return {
        doctor: {
          id: doctor.id,
          firstName: doctor.firstName,
          lastName: doctor.lastName,
          email: doctor.email,
          specialty: doctor.specialty,
          phoneNumber: doctor.phoneNumber,
          consultationPrice: doctor.consultationPrice
        },
        stats: {
          completedConsultations: completedAppointments,
          paidConsultations,
          unpaidConsultations,
          totalEarned: parseFloat(totalEarned.toFixed(2)),
          doctorShare: parseFloat(doctorShare.toFixed(2)),
          totalPaid: parseFloat(totalPaid.toFixed(2)),
          amountDue: parseFloat(amountDue.toFixed(2))
        },
        paymentHistory: paidPayments
      };
    }));

    res.json({ success: true, data: earnings });
  } catch (error) {
    logger.error('getDoctorEarnings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// POST /api/admin/doctor-payments — créer un paiement pour un médecin
exports.createDoctorPayment = async (req, res) => {
  try {
    const {
      doctorId, amount, paymentMethod, paymentDetails,
      period, consultationsCount, notes
    } = req.body;

    if (!doctorId || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'doctorId, amount et paymentMethod sont requis'
      });
    }

    const doctor = await User.findByPk(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ success: false, message: 'Médecin introuvable' });
    }

    const payment = await DoctorPayment.create({
      doctorId,
      processedBy: req.user.id,
      amount: parseFloat(amount),
      currency: req.body.currency || 'XOF',
      paymentMethod,
      paymentDetails: paymentDetails || {},
      period: period || new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      consultationsCount: parseInt(consultationsCount) || 0,
      notes: notes || null,
      status: 'completed',
      processedAt: new Date()
    });

    const full = await DoctorPayment.findByPk(payment.id, {
      include: [
        DOCTOR_INCLUDE,
        { model: User, as: 'processor', attributes: ['id','firstName','lastName'] }
      ]
    });

    logger.info(`✅ Paiement de ${amount} créé pour Dr. ${doctor.lastName} par admin ${req.user.id}`);
    res.status(201).json({ success: true, data: full });
  } catch (error) {
    logger.error('createDoctorPayment:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// PATCH /api/admin/doctor-payments/:id/status
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const payment = await DoctorPayment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Paiement introuvable' });

    await payment.update({
      status,
      processedAt: status === 'completed' ? new Date() : payment.processedAt
    });

    res.json({ success: true, data: payment });
  } catch (error) {
    logger.error('updatePaymentStatus:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
