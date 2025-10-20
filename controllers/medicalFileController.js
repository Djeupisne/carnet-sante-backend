const { MedicalFile, User, AuditLog } = require('../models');
const { validationService } = require('../services/validationService');
const { encryptionService } = require('../services/encryptionService');
const { sequelize } = require('../config/database');

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

    // Créer le dossier médical
    const medicalFile = await MedicalFile.create({
      patientId,
      doctorId: req.user.id, // Le médecin connecté
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
    await AuditLog.create({
      action: 'MEDICAL_RECORD_CREATED',
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: {
        medicalFileId: medicalFile.id,
        patientId,
        recordType
      }
    });

    res.status(201).json({
      success: true,
      message: 'Dossier médical créé avec succès',
      data: { medicalFile }
    });

  } catch (error) {
    console.error('Erreur lors de la création du dossier médical:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

exports.getPatientMedicalFiles = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { page = 1, limit = 20, recordType } = req.query;

    // Vérifier les permissions
    if (req.user.role === 'patient' && req.user.id !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé aux dossiers médicaux'
      });
    }

    // Construire la requête
    const whereClause = { patientId };
    if (recordType) {
      whereClause.recordType = recordType;
    }

    const offset = (page - 1) * limit;

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
      offset: parseInt(offset)
    });

    // Log d'accès
    await MedicalFile.update(
      {
        accessLog: sequelize.fn(
          'array_append',
          sequelize.col('accessLog'),
          {
            userId: req.user.id,
            action: 'READ',
            timestamp: new Date()
          }
        )
      },
      { where: { patientId } }
    );

    res.json({
      success: true,
      data: {
        medicalFiles,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(count / limit),
          totalRecords: count
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des dossiers médicaux:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

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
    await medicalFile.update({
      accessLog: [
        ...medicalFile.accessLog,
        {
          userId: req.user.id,
          action: 'READ_DETAIL',
          timestamp: new Date()
        }
      ]
    });

    res.json({
      success: true,
      data: { medicalFile }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du dossier médical:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

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

    // Seul le médecin créateur peut modifier
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
    await AuditLog.create({
      action: 'MEDICAL_RECORD_UPDATED',
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: {
        medicalFileId: id,
        updates
      }
    });

    res.json({
      success: true,
      message: 'Dossier médical mis à jour avec succès',
      data: { medicalFile }
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du dossier médical:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

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
    await AuditLog.create({
      action: 'MEDICAL_RECORD_DELETED',
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: {
        medicalFileId: id
      }
    });

    res.json({
      success: true,
      message: 'Dossier médical supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du dossier médical:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};