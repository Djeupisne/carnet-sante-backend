const { MedicalFile, User, AuditLog } = require('../models');
const { validationService } = require('../services/validationService');
const { sequelize } = require('../config/database');

// ============================================
// CRÉER UN DOSSIER MÉDICAL
// ============================================

exports.createMedicalRecord = async (req, res) => {
  try {
    const {
      patientId,
      recordType,
      title,
      description,
      diagnosis,
      symptoms,
      medications,
      labResults,
      vitalSigns,
      consultationDate,
      nextAppointment
    } = req.body;

    // Validation
    const validation = validationService.validateMedicalRecord(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Données médicales invalides',
        errors: validation.errors
      });
    }

    // Vérifier que le patient existe
    const patient = await User.findByPk(patientId);
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({
        success: false,
        message: 'Patient non trouvé'
      });
    }

    const medicalFile = await MedicalFile.create({
      patientId,
      doctorId: req.user.id,
      recordType,
      title,
      description,
      diagnosis,
      symptoms: symptoms || [],
      medications: medications || [],
      labResults: labResults || {},
      vitalSigns: vitalSigns || {},
      consultationDate,
      nextAppointment,
      accessLog: [{
        userId: req.user.id,
        action: 'CREATE',
        timestamp: new Date()
      }]
    });

    // Log d'audit
    try {
      await AuditLog.create({
        action: 'MEDICAL_RECORD_CREATED',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: { medicalFileId: medicalFile.id, patientId, recordType }
      });
    } catch (auditError) {
      console.warn('⚠️ Erreur audit log:', auditError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Dossier médical créé avec succès',
      data: { medicalFile }
    });

  } catch (error) {
    console.error('❌ Erreur createMedicalRecord:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      error: error.message
    });
  }
};

// ============================================
// RÉCUPÉRER LES DOSSIERS D'UN PATIENT
// ============================================

exports.getPatientMedicalFiles = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { page = 1, limit = 20, recordType } = req.query;

    console.log(`📁 Récupération des dossiers médicaux pour le patient ${patientId}...`);

    // Vérifier les permissions
    if (req.user.role === 'patient' && req.user.id !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé aux dossiers médicaux'
      });
    }

    const whereClause = { patientId };
    if (recordType) {
      whereClause.recordType = recordType;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: medicalFiles } = await MedicalFile.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ],
      order: [['consultationDate', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // ✅ CORRECTION : Log d'accès simplifié sans sequelize.fn qui causait le 500
    // On met à jour chaque fichier individuellement pour éviter l'erreur array_append
    try {
      for (const file of medicalFiles) {
        const currentLog = Array.isArray(file.accessLog) ? file.accessLog : [];
        await file.update({
          accessLog: [
            ...currentLog,
            { userId: req.user.id, action: 'READ', timestamp: new Date() }
          ]
        });
      }
    } catch (logError) {
      // Ne pas bloquer la réponse si le log échoue
      console.warn('⚠️ Erreur log accès:', logError.message);
    }

    console.log(`✅ ${medicalFiles.length} dossiers médicaux trouvés pour le patient ${patientId}`);

    res.json({
      success: true,
      data: {
        medicalFiles,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(count / parseInt(limit)),
          totalRecords: count
        }
      }
    });

  } catch (error) {
    console.error('❌ Erreur getPatientMedicalFiles:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      error: error.message
    });
  }
};

// ============================================
// RÉCUPÉRER UN DOSSIER PAR ID
// ============================================

exports.getMedicalFileById = async (req, res) => {
  try {
    const { id } = req.params;

    const medicalFile = await MedicalFile.findByPk(id, {
      include: [
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'uniqueCode', 'firstName', 'lastName', 'dateOfBirth', 'bloodType']
        },
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });

    if (!medicalFile) {
      return res.status(404).json({
        success: false,
        message: 'Dossier médical non trouvé'
      });
    }

    // Vérifier les permissions
    if (req.user.role === 'patient' && req.user.id !== medicalFile.patientId) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce dossier médical'
      });
    }

    // Log d'accès
    try {
      const currentLog = Array.isArray(medicalFile.accessLog) ? medicalFile.accessLog : [];
      await medicalFile.update({
        accessLog: [
          ...currentLog,
          { userId: req.user.id, action: 'READ_DETAIL', timestamp: new Date() }
        ]
      });
    } catch (logError) {
      console.warn('⚠️ Erreur log accès:', logError.message);
    }

    res.json({
      success: true,
      data: { medicalFile }
    });

  } catch (error) {
    console.error('❌ Erreur getMedicalFileById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      error: error.message
    });
  }
};

// ============================================
// METTRE À JOUR UN DOSSIER MÉDICAL
// ============================================

exports.updateMedicalFile = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const medicalFile = await MedicalFile.findByPk(id);
    if (!medicalFile) {
      return res.status(404).json({
        success: false,
        message: 'Dossier médical non trouvé'
      });
    }

    // Seul le médecin créateur ou un admin peut modifier
    if (medicalFile.doctorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à modifier ce dossier médical'
      });
    }

    // Validation des mises à jour
    const validation = validationService.validateMedicalRecordUpdate(updates);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Données de mise à jour invalides',
        errors: validation.errors
      });
    }

    await medicalFile.update(updates);

    // Log d'audit
    try {
      await AuditLog.create({
        action: 'MEDICAL_RECORD_UPDATED',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: { medicalFileId: id, updates }
      });
    } catch (auditError) {
      console.warn('⚠️ Erreur audit log:', auditError.message);
    }

    res.json({
      success: true,
      message: 'Dossier médical mis à jour avec succès',
      data: { medicalFile }
    });

  } catch (error) {
    console.error('❌ Erreur updateMedicalFile:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      error: error.message
    });
  }
};

// ============================================
// SUPPRIMER UN DOSSIER MÉDICAL
// ============================================

exports.deleteMedicalFile = async (req, res) => {
  try {
    const { id } = req.params;

    const medicalFile = await MedicalFile.findByPk(id);
    if (!medicalFile) {
      return res.status(404).json({
        success: false,
        message: 'Dossier médical non trouvé'
      });
    }

    // Seul le médecin créateur ou un admin peut supprimer
    if (medicalFile.doctorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à supprimer ce dossier médical'
      });
    }

    await medicalFile.destroy();

    // Log d'audit
    try {
      await AuditLog.create({
        action: 'MEDICAL_RECORD_DELETED',
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: { medicalFileId: id }
      });
    } catch (auditError) {
      console.warn('⚠️ Erreur audit log:', auditError.message);
    }

    res.json({
      success: true,
      message: 'Dossier médical supprimé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur deleteMedicalFile:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      error: error.message
    });
  }
};
