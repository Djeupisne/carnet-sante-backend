const { sequelize } = require('../config/database');
const { Sequelize, DataTypes, Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

const db = {};

// ✅ LISTE DES FICHIERS DE MODÈLES
const modelFiles = [
  'MedicalFile.js',
  'Payment.js',
  'Notification.js',
  'User.js',
  'Appointment.js',
  'AuditLog.js',
  'Review.js',
  'Calendar.js'
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
      
    case 'Notification':  // ✅ CORRIGÉ - VERSION COMPLÈTE
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
        userId: DataTypes.UUID,
        action: { type: DataTypes.STRING, allowNull: false },
        ipAddress: DataTypes.STRING,
        userAgent: DataTypes.TEXT,
        details: DataTypes.JSONB
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
  }

  const Model = sequelize.define(modelName, attributes, {
    ...options,
    timestamps: true,
    paranoid: modelName === 'User' ? true : false
  });
  
  db[Model.name] = Model;
  console.log(`✅ Modèle ${modelName} créé dynamiquement`);
}

// ✅ VÉRIFIER LES MODÈLES CRITIQUES
const criticalModels = ['User', 'Appointment', 'Notification', 'Calendar', 'MedicalFile', 'Payment'];
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

  // ✅ User ↔ Notification - CORRIGÉ
  if (db.User && db.Notification) {
    db.User.hasMany(db.Notification, { 
      as: 'notifications', 
      foreignKey: 'userId' 
    });
    db.Notification.belongsTo(db.User, { 
      as: 'user', 
      foreignKey: 'userId' 
    });
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

  // User ↔ AuditLog
  if (db.User && db.AuditLog) {
    db.User.hasMany(db.AuditLog, { as: 'auditLogs', foreignKey: 'userId' });
    db.AuditLog.belongsTo(db.User, { as: 'user', foreignKey: 'userId' });
    console.log('✅ Associations User-AuditLog');
  }
}

// Exécuter les associations
setupAssociations();

// ✅ SYNCHRONISATION SANS ALTER
const syncModels = async () => {
  try {
    await sequelize.sync({ 
      alter: false,
      force: false,
      logging: false
    });
    console.log('✅ Modèles synchronisés avec la base de données');
    return true;
  } catch (error) {
    console.error('❌ Erreur synchronisation:', error.message);
    
    try {
      await sequelize.sync({ force: false, logging: false });
      console.log('✅ Synchronisation mode secours réussie');
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
