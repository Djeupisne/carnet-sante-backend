// controllers/videoCallController.js
const { VideoCall, User } = require('../models');
const { logger } = require('../utils/logger');

const INCLUDE = [
  { model: User, as: 'patient', attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'] },
  { model: User, as: 'doctor',  attributes: ['id', 'firstName', 'lastName', 'specialty'] }
];

// ============================================================
// GET /api/video-calls  — historique selon le rôle
// ============================================================
exports.getMyVideoCalls = async (req, res) => {
  try {
    const where = req.user.role === 'patient'
      ? { patientId: req.user.id }
      : { doctorId:  req.user.id };

    const calls = await VideoCall.findAll({
      where,
      include: INCLUDE,
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, data: calls });
  } catch (error) {
    logger.error('getMyVideoCalls:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ============================================================
// GET /api/video-calls/patient/:patientId
// ============================================================
exports.getPatientVideoCalls = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (req.user.role === 'patient' && req.user.id !== patientId) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const calls = await VideoCall.findAll({
      where: { patientId },
      include: INCLUDE,
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, data: calls });
  } catch (error) {
    logger.error('getPatientVideoCalls:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ============================================================
// POST /api/video-calls  — médecin crée l'appel
// ============================================================
exports.createVideoCall = async (req, res) => {
  try {
    const { patientId, appointmentId, roomLink, notes } = req.body;

    if (!patientId || !roomLink) {
      return res.status(400).json({ success: false, message: 'patientId et roomLink sont requis' });
    }

    const call = await VideoCall.create({
      patientId,
      doctorId: req.user.id,
      appointmentId: appointmentId || null,
      roomLink,
      notes: notes || null,
      status: 'scheduled'
    });

    const full = await VideoCall.findByPk(call.id, { include: INCLUDE });
    res.status(201).json({ success: true, data: full });
  } catch (error) {
    logger.error('createVideoCall:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ============================================================
// PATCH /api/video-calls/:id/start
// ============================================================
exports.startVideoCall = async (req, res) => {
  try {
    const call = await VideoCall.findByPk(req.params.id);
    if (!call) return res.status(404).json({ success: false, message: 'Appel introuvable' });

    await call.update({ status: 'ongoing', startedAt: new Date() });
    res.json({ success: true, data: call });
  } catch (error) {
    logger.error('startVideoCall:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ============================================================
// PATCH /api/video-calls/:id/end
// ============================================================
exports.endVideoCall = async (req, res) => {
  try {
    const call = await VideoCall.findByPk(req.params.id);
    if (!call) return res.status(404).json({ success: false, message: 'Appel introuvable' });

    const endedAt = new Date();
    const durationMinutes = call.startedAt
      ? Math.round((endedAt - new Date(call.startedAt)) / 60000)
      : null;

    await call.update({ status: 'completed', endedAt, durationMinutes });
    res.json({ success: true, data: call });
  } catch (error) {
    logger.error('endVideoCall:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
