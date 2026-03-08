// controllers/prescriptionController.js
const { Prescription, User } = require('../models');
const { logger } = require('../utils/logger');

// ─── Inclure patient + médecin dans chaque requête ───────────────────────────
const INCLUDE = [
  { model: User, as: 'patient', attributes: ['id', 'firstName', 'lastName', 'email'] },
  { model: User, as: 'doctor',  attributes: ['id', 'firstName', 'lastName', 'specialty'] }
];

// ============================================================
// GET /api/prescriptions  (patient → ses propres ; médecin → celles qu'il a créées)
// ============================================================
exports.getMyPrescriptions = async (req, res) => {
  try {
    const where = req.user.role === 'patient'
      ? { patientId: req.user.id }
      : { doctorId:  req.user.id };

    const prescriptions = await Prescription.findAll({
      where,
      include: INCLUDE,
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, data: prescriptions });
  } catch (error) {
    logger.error('getMyPrescriptions:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ============================================================
// GET /api/prescriptions/patient/:patientId  (médecin / admin)
// ============================================================
exports.getPatientPrescriptions = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Un patient ne peut voir que ses propres prescriptions
    if (req.user.role === 'patient' && req.user.id !== patientId) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const prescriptions = await Prescription.findAll({
      where: { patientId },
      include: INCLUDE,
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, data: prescriptions });
  } catch (error) {
    logger.error('getPatientPrescriptions:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ============================================================
// GET /api/prescriptions/:id
// ============================================================
exports.getPrescriptionById = async (req, res) => {
  try {
    const prescription = await Prescription.findByPk(req.params.id, { include: INCLUDE });

    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription introuvable' });
    }

    // Vérification accès
    if (
      req.user.role === 'patient' && prescription.patientId !== req.user.id
    ) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    // Marquer comme lu si c'est le patient qui consulte
    if (req.user.role === 'patient' && !prescription.isRead) {
      await prescription.update({ isRead: true });
    }

    res.json({ success: true, data: prescription });
  } catch (error) {
    logger.error('getPrescriptionById:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ============================================================
// POST /api/prescriptions  (médecin uniquement)
// ============================================================
exports.createPrescription = async (req, res) => {
  try {
    const { patientId, appointmentId, medications, notes, validUntil } = req.body;

    if (!patientId || !medications || !Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'patientId et medications[] sont requis'
      });
    }

    // Vérifier que le patient existe
    const patient = await User.findByPk(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient introuvable' });
    }

    const prescription = await Prescription.create({
      patientId,
      doctorId: req.user.id,
      appointmentId: appointmentId || null,
      medications,
      notes: notes || null,
      validUntil: validUntil || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 3 mois par défaut
      status: 'active',
      isRead: false
    });

    // Recharger avec les associations
    const full = await Prescription.findByPk(prescription.id, { include: INCLUDE });

    logger.info(`✅ Prescription créée par Dr. ${req.user.lastName} pour patient ${patientId}`);
    res.status(201).json({ success: true, data: full });
  } catch (error) {
    logger.error('createPrescription:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ============================================================
// PATCH /api/prescriptions/:id/status  (médecin / admin)
// ============================================================
exports.updatePrescriptionStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['active', 'completed', 'cancelled'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Statut invalide' });
    }

    const prescription = await Prescription.findByPk(req.params.id);
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription introuvable' });
    }

    await prescription.update({ status });
    res.json({ success: true, data: prescription });
  } catch (error) {
    logger.error('updatePrescriptionStatus:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ============================================================
// DELETE /api/prescriptions/:id  (médecin auteur ou admin)
// ============================================================
exports.deletePrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findByPk(req.params.id);
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription introuvable' });
    }

    if (req.user.role !== 'admin' && prescription.doctorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    await prescription.destroy();
    res.json({ success: true, message: 'Prescription supprimée' });
  } catch (error) {
    logger.error('deletePrescription:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
