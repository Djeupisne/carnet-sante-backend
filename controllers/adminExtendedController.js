// controllers/adminExtendedController.js
const { Prescription, VideoCall, DoctorPayment, User, Appointment } = require('../models');
const { logger } = require('../utils/logger');

// ✅ Aliases alignés avec models/index.js
const DOCTOR_INCLUDE    = { model: User, as: 'doctor',    attributes: ['id','firstName','lastName','email','specialty','phoneNumber'] };
const PATIENT_INCLUDE   = { model: User, as: 'patient',   attributes: ['id','firstName','lastName','email','phoneNumber'] };
const PROCESSOR_INCLUDE = { model: User, as: 'processor', attributes: ['id','firstName','lastName'] };

// ══════════════════════════════════════════════
// PRESCRIPTIONS (vue admin)
// ══════════════════════════════════════════════
exports.getAllPrescriptions = async (req, res) => {
  try {
    const { status, doctorId, patientId, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status)    where.status    = status;
    if (doctorId)  where.doctorId  = doctorId;
    if (patientId) where.patientId = patientId;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await Prescription.findAndCountAll({
      where, include: [DOCTOR_INCLUDE, PATIENT_INCLUDE],
      order: [['createdAt', 'DESC']], limit: parseInt(limit), offset
    });

    res.json({ success: true, data: rows, pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) } });
  } catch (error) {
    logger.error('getAllPrescriptions (admin):', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ══════════════════════════════════════════════
// APPELS VIDÉO (vue admin)
// ══════════════════════════════════════════════
exports.getAllVideoCalls = async (req, res) => {
  try {
    const { status, doctorId, patientId, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status)    where.status    = status;
    if (doctorId)  where.doctorId  = doctorId;
    if (patientId) where.patientId = patientId;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await VideoCall.findAndCountAll({
      where, include: [DOCTOR_INCLUDE, PATIENT_INCLUDE],
      order: [['createdAt', 'DESC']], limit: parseInt(limit), offset
    });

    res.json({ success: true, data: rows, pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) } });
  } catch (error) {
    logger.error('getAllVideoCalls (admin):', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ══════════════════════════════════════════════
// REVENUS CALCULÉS PAR MÉDECIN
// ══════════════════════════════════════════════
exports.getDoctorEarnings = async (req, res) => {
  try {
    const doctors = await User.findAll({
      where: { role: 'doctor', isActive: true },
      attributes: ['id','firstName','lastName','email','specialty','consultationPrice','phoneNumber']
    });

    const earnings = await Promise.all(doctors.map(async (doctor) => {
      const completedAppointments = await Appointment.count({ where: { doctorId: doctor.id, status: 'completed' } });

      const paidPayments = await DoctorPayment.findAll({
        where: { doctorId: doctor.id, status: 'completed' },
        attributes: ['amount','consultationsCount','period','processedAt','paymentMethod']
      });

      const totalPaid           = paidPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
      const paidConsultations   = paidPayments.reduce((s, p) => s + (p.consultationsCount || 0), 0);
      const unpaidConsultations = Math.max(0, completedAppointments - paidConsultations);
      const price               = parseFloat(doctor.consultationPrice || 0);
      const totalEarned         = completedAppointments * price;
      const doctorShare         = totalEarned * 0.9;
      const amountDue           = unpaidConsultations * price * 0.9;

      return {
        doctor: { id: doctor.id, firstName: doctor.firstName, lastName: doctor.lastName, email: doctor.email, specialty: doctor.specialty, phoneNumber: doctor.phoneNumber, consultationPrice: doctor.consultationPrice },
        stats: { completedConsultations: completedAppointments, paidConsultations, unpaidConsultations, totalEarned: parseFloat(totalEarned.toFixed(2)), doctorShare: parseFloat(doctorShare.toFixed(2)), totalPaid: parseFloat(totalPaid.toFixed(2)), amountDue: parseFloat(amountDue.toFixed(2)) },
        paymentHistory: paidPayments
      };
    }));

    res.json({ success: true, data: earnings });
  } catch (error) {
    logger.error('getDoctorEarnings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ══════════════════════════════════════════════
// LISTE DES PAIEMENTS VERSÉS
// ══════════════════════════════════════════════
exports.getDoctorPayments = async (req, res) => {
  try {
    const { status, doctorId, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status)   where.status   = status;
    if (doctorId) where.doctorId = doctorId;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await DoctorPayment.findAndCountAll({
      where, include: [DOCTOR_INCLUDE, PROCESSOR_INCLUDE],
      order: [['createdAt', 'DESC']], limit: parseInt(limit), offset
    });

    res.json({ success: true, data: rows, pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) } });
  } catch (error) {
    logger.error('getDoctorPayments:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ══════════════════════════════════════════════
// CRÉER UN PAIEMENT POUR UN MÉDECIN
// ══════════════════════════════════════════════
exports.createDoctorPayment = async (req, res) => {
  try {
    const { doctorId, amount, paymentMethod, paymentDetails, period, consultationsCount, notes, currency } = req.body;

    if (!doctorId || !amount || !paymentMethod) {
      return res.status(400).json({ success: false, message: 'doctorId, amount et paymentMethod sont requis' });
    }

    const doctor = await User.findByPk(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ success: false, message: 'Médecin introuvable' });
    }

    const payment = await DoctorPayment.create({
      doctorId,
      processedBy:        req.user.id,
      amount:             parseFloat(amount),
      currency:           currency || 'XOF',
      paymentMethod,
      paymentDetails:     paymentDetails || {},
      period:             period || new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      consultationsCount: parseInt(consultationsCount) || 0,
      notes:              notes || null,
      status:             'completed',
      processedAt:        new Date()
    });

    const full = await DoctorPayment.findByPk(payment.id, { include: [DOCTOR_INCLUDE, PROCESSOR_INCLUDE] });

    logger.info(`✅ Paiement ${amount} ${currency || 'XOF'} → Dr. ${doctor.lastName} par admin ${req.user.id}`);
    res.status(201).json({ success: true, data: full });
  } catch (error) {
    logger.error('createDoctorPayment:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', detail: error.message });
  }
};

// ══════════════════════════════════════════════
// METTRE À JOUR LE STATUT D'UN PAIEMENT
// ══════════════════════════════════════════════
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const payment = await DoctorPayment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Paiement introuvable' });

    await payment.update({ status, processedAt: status === 'completed' ? new Date() : payment.processedAt });
    res.json({ success: true, data: payment });
  } catch (error) {
    logger.error('updatePaymentStatus:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
