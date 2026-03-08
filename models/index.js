const { sequelize } = require('../config/database');
const { Sequelize, DataTypes, Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

const db = {};

// ✅ LISTE DES FICHIERS DE MODÈLES (MISE À JOUR AVEC PRESCRIPTION ET VIDEOCALL)
const modelFiles = [
  'MedicalFile.js',
  'Payment.js',
  'Notification.js',
  'User.js',
  'Appointment.js',
  'AuditLog.js',
  'Review.js',
  'Calendar.js',
  'Prescription.js',  // NOUVEAU MODÈLE
  'VideoCall.js'      // NOUVEAU MODÈLE
];

// ✅ CHARGER CHAQUE MODÈLE DIRECTEMENT
modelFiles.forEach(file => {
  try {
    const modelPath = path.join(__dirname, file);
    
    if (fs.existsSync(modelPath)) {
      const model = require(modelPath);
      
      if (model && model.name) {
        db[model.name] = model;
        console.log(`✅ Modèle chargé: ${model.name}`);
      } else {
        console.warn(`⚠️ ${file} n'a pas de propriété 'name'`);
        createModelDynamically(file.replace('.js', ''));
      }
    } else {
      console.log(`📝 Fichier ${file} non trouvé, création dynamique...`);
      createModelDynamically(file.replace('.js', ''));
    }
  } catch (error) {
    console.error(`❌ Erreur lors du chargement de ${file}:`, error.message);
    createModelDynamically(file.replace('.js', ''));
  }
});

// ✅ CRÉATION DYNAMIQUE DES MODÈLES
function createModelDynamically(modelName) {
  console.log(`🔄 Création dynamique du modèle ${modelName}...`);
  
  let attributes = {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    }
  };
  
  let options = {
    tableName: `${modelName}s`,
    indexes: []
  };

  switch(modelName) {
    case 'User':
      attributes = {
        ...attributes,
        firstName: DataTypes.STRING,
        lastName: DataTypes.STRING,
        email: { type: DataTypes.STRING, unique: true },
        role: { type: DataTypes.STRING, defaultValue: 'patient' },
        specialty: DataTypes.STRING,
        consultationPrice: { type: DataTypes.INTEGER, defaultValue: 50 },
        isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
        phoneNumber: DataTypes.STRING,
        password: DataTypes.STRING
      };
      break;
      
    case 'Appointment':
      attributes = {
        ...attributes,
        patientId: { type: DataTypes.UUID, allowNull: false },
        doctorId: { type: DataTypes.UUID, allowNull: false },
        appointmentDate: { type: DataTypes.DATE, allowNull: false },
        duration: { type: DataTypes.INTEGER, defaultValue: 30 },
        status: { 
          type: DataTypes.ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show'),
          defaultValue: 'pending'
        },
        type: { 
          type: DataTypes.ENUM('in_person', 'teleconsultation', 'home_visit'),
          defaultValue: 'in_person'
        },
        reason: DataTypes.TEXT,
        symptoms: DataTypes.JSONB,
        notes: DataTypes.TEXT
      };
      options.indexes = [
        { fields: ['patientId'] },
        { fields: ['doctorId'] },
        { fields: ['appointmentDate'] },
        { fields: ['status'] }
      ];
      break;
      
    case 'Notification':
      attributes = {
        ...attributes,
        userId: { type: DataTypes.UUID, allowNull: false },
        type: { type: DataTypes.STRING, allowNull: false },
        title: { type: DataTypes.STRING, allowNull: false },
        message: { type: DataTypes.TEXT, allowNull: false },
        data: { type: DataTypes.JSONB, defaultValue: {} },
        isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
        priority: { 
          type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
          defaultValue: 'medium'
        },
        scheduledFor: { type: DataTypes.DATE },
        sentAt: { type: DataTypes.DATE }
      };
      options.indexes = [
        { fields: ['userId'] },
        { fields: ['userId', 'isRead'] },
        { fields: ['scheduledFor'] }
      ];
      break;
      
    case 'Calendar':
      attributes = {
        ...attributes,
        date: { type: DataTypes.STRING, allowNull: false },
        slots: { type: DataTypes.JSON, defaultValue: [] },
        confirmed: { type: DataTypes.BOOLEAN, defaultValue: false },
        doctorId: { type: DataTypes.UUID, allowNull: false },
        versions: { type: DataTypes.JSON, defaultValue: [] }
      };
      options.indexes = [
        { unique: true, fields: ['doctorId', 'date'] }
      ];
      break;
      
    case 'MedicalFile':
      attributes = {
        ...attributes,
        patientId: { type: DataTypes.UUID, allowNull: false },
        doctorId: { type: DataTypes.UUID, allowNull: false },
        recordType: { type: DataTypes.STRING, allowNull: false },
        title: { type: DataTypes.STRING, allowNull: false },
        description: DataTypes.TEXT,
        diagnosis: DataTypes.TEXT,
        symptoms: DataTypes.JSONB,
        medications: DataTypes.JSONB,
        consultationDate: { type: DataTypes.DATE, allowNull: false }
      };
      break;
      
    case 'Payment':
      attributes = {
        ...attributes,
        appointmentId: { type: DataTypes.UUID, allowNull: false },
        patientId: { type: DataTypes.UUID, allowNull: false },
        doctorId: { type: DataTypes.UUID, allowNull: false },
        amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        currency: { type: DataTypes.STRING, defaultValue: 'EUR' },
        status: { 
          type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
          defaultValue: 'pending'
        },
        paymentMethod: { type: DataTypes.STRING },
        transactionId: { type: DataTypes.STRING, unique: true },
        paymentDate: DataTypes.DATE
      };
      break;
      
    case 'AuditLog':
      attributes = {
        ...attributes,
        userId: { 
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id'
          }
        },
        userRole: { 
          type: DataTypes.ENUM('patient', 'doctor', 'admin', 'hospital_admin'),
          allowNull: true
        },
        action: { type: DataTypes.STRING, allowNull: false },
        ipAddress: DataTypes.STRING,
        userAgent: DataTypes.TEXT,
        resource: DataTypes.STRING,
        resourceId: DataTypes.UUID,
        details: DataTypes.JSONB,
        status: { 
          type: DataTypes.ENUM('success', 'failure'),
          defaultValue: 'success'
        },
        errorMessage: DataTypes.TEXT
      };
      break;
      
    case 'Review':
      attributes = {
        ...attributes,
        doctorId: { type: DataTypes.UUID, allowNull: false },
        patientId: { type: DataTypes.UUID, allowNull: false },
        appointmentId: DataTypes.UUID,
        rating: { type: DataTypes.INTEGER, validate: { min: 1, max: 5 } },
        comment: DataTypes.TEXT
      };
      break;

    case 'Prescription':  // NOUVEAU MODÈLE DYNAMIQUE
      attributes = {
        ...attributes,
        patientId: { type: DataTypes.UUID, allowNull: false },
        doctorId: { type: DataTypes.UUID, allowNull: false },
        appointmentId: { type: DataTypes.UUID, allowNull: true },
        medications: { type: DataTypes.JSONB, allowNull: false }, // [{ name, dosage, frequency, duration, instructions }]
        diagnosis: DataTypes.TEXT,
        notes: DataTypes.TEXT,
        issueDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        expiryDate: DataTypes.DATE,
        status: { 
          type: DataTypes.ENUM('active', 'filled', 'expired', 'cancelled'),
          defaultValue: 'active'
        },
        refills: { type: DataTypes.INTEGER, defaultValue: 0 },
        refillsUsed: { type: DataTypes.INTEGER, defaultValue: 0 },
        qrCode: DataTypes.STRING,
        isElectronic: { type: DataTypes.BOOLEAN, defaultValue: true }
      };
      options.indexes = [
        { fields: ['patientId'] },
        { fields: ['doctorId'] },
        { fields: ['appointmentId'] },
        { fields: ['issueDate'] },
        { fields: ['status'] }
      ];
      break;

    case 'VideoCall':  // NOUVEAU MODÈLE DYNAMIQUE
      attributes = {
        ...attributes,
        appointmentId: { type: DataTypes.UUID, allowNull: false, unique: true },
        patientId: { type: DataTypes.UUID, allowNull: false },
        doctorId: { type: DataTypes.UUID, allowNull: false },
        roomName: { type: DataTypes.STRING, allowNull: false, unique: true },
        roomSid: DataTypes.STRING,
        status: { 
          type: DataTypes.ENUM('scheduled', 'active', 'completed', 'missed', 'cancelled'),
          defaultValue: 'scheduled'
        },
        scheduledStartTime: { type: DataTypes.DATE, allowNull: false },
        actualStartTime: DataTypes.DATE,
        actualEndTime: DataTypes.DATE,
        duration: DataTypes.INTEGER, // en secondes
        recordingUrl: DataTypes.STRING,
        recordingSid: DataTypes.STRING,
        recordingStatus: { 
          type: DataTypes.ENUM('none', 'requested', 'in_progress', 'completed', 'failed'),
          defaultValue: 'none'
        },
        participants: { type: DataTypes.JSONB, defaultValue: [] },
        meetingUrl: DataTypes.STRING,
        joinToken: DataTypes.TEXT,
        endedBy: DataTypes.UUID,
        endReason: DataTypes.STRING,
        quality: { 
          type: DataTypes.ENUM('excellent', 'good', 'fair', 'poor'),
        },
        notes: DataTypes.TEXT,
        recordingConsent: { type: DataTypes.BOOLEAN, defaultValue: false }
      };
      options.indexes = [
        { fields: ['appointmentId'], unique: true },
        { fields: ['patientId'] },
        { fields: ['doctorId'] },
        { fields: ['status'] },
        { fields: ['scheduledStartTime'] },
        { fields: ['roomName'], unique: true }
      ];
      break;
  }

  const Model = sequelize.define(modelName, attributes, {
    ...options,
    timestamps: true,
    paranoid: modelName === 'User' ? true : false
  });
  
  db[Model.name] = Model;
  console.log(`✅ Modèle ${modelName} créé dynamiquement`);
}

// ✅ VÉRIFIER LES MODÈLES CRITIQUES (MISE À JOUR AVEC PRESCRIPTION ET VIDEOCALL)
const criticalModels = ['User', 'Appointment', 'Notification', 'Calendar', 'MedicalFile', 'Payment', 'AuditLog', 'Prescription', 'VideoCall'];
criticalModels.forEach(modelName => {
  if (!db[modelName]) {
    createModelDynamically(modelName);
  }
});

console.log('🔍 Modèles chargés dans db:', Object.keys(db));

// ✅ DÉFINIR TOUTES LES ASSOCIATIONS
function setupAssociations() {
  // User ↔ Appointment
  if (db.User && db.Appointment) {
    db.User.hasMany(db.Appointment, { as: 'patientAppointments', foreignKey: 'patientId' });
    db.User.hasMany(db.Appointment, { as: 'doctorAppointments', foreignKey: 'doctorId' });
    db.Appointment.belongsTo(db.User, { as: 'patient', foreignKey: 'patientId' });
    db.Appointment.belongsTo(db.User, { as: 'doctor', foreignKey: 'doctorId' });
    console.log('✅ Associations User-Appointment');
  }

  // User ↔ MedicalFile
  if (db.User && db.MedicalFile) {
    db.User.hasMany(db.MedicalFile, { as: 'medicalFiles', foreignKey: 'patientId' });
    db.MedicalFile.belongsTo(db.User, { as: 'patient', foreignKey: 'patientId' });
    db.MedicalFile.belongsTo(db.User, { as: 'doctor', foreignKey: 'doctorId' });
    console.log('✅ Associations User-MedicalFile');
  }

  // Appointment ↔ Payment
  if (db.Appointment && db.Payment) {
    db.Appointment.hasOne(db.Payment, { as: 'payment', foreignKey: 'appointmentId' });
    db.Payment.belongsTo(db.Appointment, { as: 'appointment', foreignKey: 'appointmentId' });
    console.log('✅ Associations Appointment-Payment');
  }

  // User ↔ Notification
  if (db.User && db.Notification) {
    db.User.hasMany(db.Notification, { as: 'notifications', foreignKey: 'userId' });
    db.Notification.belongsTo(db.User, { as: 'user', foreignKey: 'userId' });
    console.log('✅ Associations User-Notification');
  }

  // User ↔ Calendar
  if (db.User && db.Calendar) {
    db.User.hasMany(db.Calendar, { as: 'calendars', foreignKey: 'doctorId' });
    db.Calendar.belongsTo(db.User, { as: 'doctor', foreignKey: 'doctorId' });
    console.log('✅ Associations User-Calendar');
  }

  // User ↔ Payment
  if (db.User && db.Payment) {
    db.User.hasMany(db.Payment, { as: 'patientPayments', foreignKey: 'patientId' });
    db.User.hasMany(db.Payment, { as: 'doctorPayments', foreignKey: 'doctorId' });
    db.Payment.belongsTo(db.User, { as: 'patient', foreignKey: 'patientId' });
    db.Payment.belongsTo(db.User, { as: 'doctor', foreignKey: 'doctorId' });
    console.log('✅ Associations User-Payment');
  }

  // User ↔ Review
  if (db.User && db.Review) {
    db.User.hasMany(db.Review, { as: 'reviews', foreignKey: 'doctorId' });
    db.Review.belongsTo(db.User, { as: 'doctor', foreignKey: 'doctorId' });
    db.Review.belongsTo(db.User, { as: 'patient', foreignKey: 'patientId' });
    console.log('✅ Associations User-Review');
  }

  // User ↔ AuditLog (sans contrainte)
  if (db.User && db.AuditLog) {
    db.User.hasMany(db.AuditLog, { 
      as: 'auditLogs', 
      foreignKey: 'userId',
      constraints: false
    });
    
    db.AuditLog.belongsTo(db.User, { 
      as: 'user', 
      foreignKey: 'userId',
      constraints: false
    });
    
    console.log('✅ Associations User-AuditLog (sans contrainte)');
  }

  // ============================================
  // NOUVELLES ASSOCIATIONS POUR Prescription
  // ============================================
  
  // Prescription ↔ User (Patient)
  if (db.Prescription && db.User) {
    db.Prescription.belongsTo(db.User, { as: 'patient', foreignKey: 'patientId' });
    db.User.hasMany(db.Prescription, { as: 'patientPrescriptions', foreignKey: 'patientId' });
    console.log('✅ Associations Prescription-Patient');
  }

  // Prescription ↔ User (Doctor)
  if (db.Prescription && db.User) {
    db.Prescription.belongsTo(db.User, { as: 'doctor', foreignKey: 'doctorId' });
    db.User.hasMany(db.Prescription, { as: 'doctorPrescriptions', foreignKey: 'doctorId' });
    console.log('✅ Associations Prescription-Doctor');
  }

  // Prescription ↔ Appointment
  if (db.Prescription && db.Appointment) {
    db.Prescription.belongsTo(db.Appointment, { as: 'appointment', foreignKey: 'appointmentId' });
    db.Appointment.hasMany(db.Prescription, { as: 'prescriptions', foreignKey: 'appointmentId' });
    console.log('✅ Associations Prescription-Appointment');
  }

  // ============================================
  // NOUVELLES ASSOCIATIONS POUR VideoCall
  // ============================================
  
  // VideoCall ↔ Appointment
  if (db.VideoCall && db.Appointment) {
    db.VideoCall.belongsTo(db.Appointment, { as: 'appointment', foreignKey: 'appointmentId' });
    db.Appointment.hasOne(db.VideoCall, { as: 'videoCall', foreignKey: 'appointmentId' });
    console.log('✅ Associations VideoCall-Appointment');
  }

  // VideoCall ↔ User (Patient)
  if (db.VideoCall && db.User) {
    db.VideoCall.belongsTo(db.User, { as: 'patient', foreignKey: 'patientId' });
    db.User.hasMany(db.VideoCall, { as: 'patientVideoCalls', foreignKey: 'patientId' });
    console.log('✅ Associations VideoCall-Patient');
  }

  // VideoCall ↔ User (Doctor)
  if (db.VideoCall && db.User) {
    db.VideoCall.belongsTo(db.User, { as: 'doctor', foreignKey: 'doctorId' });
    db.User.hasMany(db.VideoCall, { as: 'doctorVideoCalls', foreignKey: 'doctorId' });
    console.log('✅ Associations VideoCall-Doctor');
  }

  // VideoCall ↔ User (EndedBy)
  if (db.VideoCall && db.User) {
    db.VideoCall.belongsTo(db.User, { as: 'endedByUser', foreignKey: 'endedBy' });
    console.log('✅ Associations VideoCall-EndedBy');
  }
}

// Exécuter les associations
setupAssociations();

// ✅ SUPPRESSION DE LA CONTRAINTE AVEC SQL DIRECT (SOLUTION ROBUSTE)
async function removeForeignKeyConstraint() {
  try {
    console.log('🔍 Vérification des contraintes sur AuditLogs...');
    
    // Vérifier si la contrainte existe
    const constraints = await sequelize.query(
      `SELECT conname 
       FROM pg_constraint 
       WHERE conrelid = 'AuditLogs'::regclass 
       AND conname = 'AuditLogs_userId_fkey'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    
    if (constraints.length > 0) {
      console.log('🗑️ Suppression de la contrainte AuditLogs_userId_fkey avec SQL direct...');
      
      // Utiliser SQL direct au lieu de queryInterface
      await sequelize.query(
        `ALTER TABLE "AuditLogs" DROP CONSTRAINT IF EXISTS "AuditLogs_userId_fkey";`
      );
      
      console.log('✅ Contrainte supprimée avec succès via SQL direct');
      
      // Vérifier que la contrainte a bien été supprimée
      const checkAfter = await sequelize.query(
        `SELECT conname 
         FROM pg_constraint 
         WHERE conrelid = 'AuditLogs'::regclass 
         AND conname = 'AuditLogs_userId_fkey'`,
        { type: sequelize.QueryTypes.SELECT }
      );
      
      if (checkAfter.length === 0) {
        console.log('✅ Vérification: contrainte bien supprimée');
      } else {
        console.log('⚠️ La contrainte existe toujours, tentative avec CASCADE...');
        await sequelize.query(
          `ALTER TABLE "AuditLogs" DROP CONSTRAINT "AuditLogs_userId_fkey" CASCADE;`
        );
        console.log('✅ Contrainte supprimée avec CASCADE');
      }
    } else {
      console.log('✅ La contrainte AuditLogs_userId_fkey n\'existe pas');
    }
  } catch (error) {
    console.log('⚠️ Erreur lors de la suppression de la contrainte (ignorée):', error.message);
    
    // Dernière tentative avec CASCADE
    try {
      console.log('🔄 Dernière tentative avec CASCADE...');
      await sequelize.query(
        `ALTER TABLE "AuditLogs" DROP CONSTRAINT IF EXISTS "AuditLogs_userId_fkey" CASCADE;`
      );
      console.log('✅ Contrainte supprimée avec CASCADE');
    } catch (e) {
      console.log('⚠️ Échec final (ignoré):', e.message);
    }
  }
}

// ✅ SYNCHRONISATION SANS ALTER
const syncModels = async () => {
  try {
    await sequelize.sync({ 
      alter: false,
      force: false,
      logging: false
    });
    console.log('✅ Modèles synchronisés avec la base de données');
    
    // Supprimer la contrainte après synchronisation
    await removeForeignKeyConstraint();
    
    return true;
  } catch (error) {
    console.error('❌ Erreur synchronisation:', error.message);
    
    try {
      await sequelize.sync({ force: false, logging: false });
      console.log('✅ Synchronisation mode secours réussie');
      
      // Supprimer la contrainte après synchronisation
      await removeForeignKeyConstraint();
      
      return true;
    } catch (e) {
      console.error('❌ Échec synchronisation:', e.message);
      return false;
    }
  }
};

// ✅ EXPORTER TOUT
module.exports = {
  ...db,
  sequelize,
  Sequelize,
  DataTypes,
  Op,
  syncModels
};

console.log('✅ models/index.js chargé avec succès');
console.log('📦 Modèles exportés:', Object.keys(db));
