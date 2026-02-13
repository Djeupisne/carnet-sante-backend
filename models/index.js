const { sequelize } = require('../config/database');
const { Sequelize, DataTypes, Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

const db = {};

// ✅ LISTE DES FICHIERS DE MODÈLES (ceux que vous m'avez montrés)
const modelFiles = [
  'MedicalFile.js',
  'Payment.js',
  'Notification.js',
  'User.js',          // Assurez-vous d'avoir ce fichier
  'Appointment.js',   // Assurez-vous d'avoir ce fichier
  'AuditLog.js',      // Assurez-vous d'avoir ce fichier
  'Review.js',        // Assurez-vous d'avoir ce fichier
  'Calendar.js'       // À créer si nécessaire
];

// ✅ CHARGER CHAQUE MODÈLE DIRECTEMENT (SANS LES APPELER COMME DES FONCTIONS)
modelFiles.forEach(file => {
  try {
    const modelPath = path.join(__dirname, file);
    
    // Vérifier si le fichier existe
    if (fs.existsSync(modelPath)) {
      const model = require(modelPath);
      
      // ✅ VOS MODÈLES SONT DÉJÀ DES INSTANCES DE sequelize.define !
      if (model && model.name) {
        db[model.name] = model;
        console.log(`✅ Modèle chargé: ${model.name}`);
      } else {
        console.warn(`⚠️ ${file} n'a pas de propriété 'name'`);
      }
    } else {
      console.log(`📝 Fichier ${file} non trouvé, création dynamique...`);
      createModelDynamically(file.replace('.js', ''));
    }
  } catch (error) {
    console.error(`❌ Erreur lors du chargement de ${file}:`, error.message);
    // Créer le modèle dynamiquement en cas d'erreur
    createModelDynamically(file.replace('.js', ''));
  }
});

// ✅ CRÉATION DYNAMIQUE DES MODÈLES MANQUANTS
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

  // Définir les attributs selon le modèle
  switch(modelName) {
    case 'User':
      attributes = {
        ...attributes,
        firstName: DataTypes.STRING,
        lastName: DataTypes.STRING,
        email: { type: DataTypes.STRING, unique: true },
        role: DataTypes.STRING,
        specialty: DataTypes.STRING,
        consultationPrice: { type: DataTypes.INTEGER, defaultValue: 50 },
        isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
      };
      break;
      
    case 'Appointment':
      attributes = {
        ...attributes,
        patientId: { type: DataTypes.UUID, allowNull: false },
        doctorId: { type: DataTypes.UUID, allowNull: false },
        appointmentDate: { type: DataTypes.DATE, allowNull: false },
        duration: { type: DataTypes.INTEGER, defaultValue: 30 },
        status: { type: DataTypes.STRING, defaultValue: 'pending' },
        type: { type: DataTypes.STRING, defaultValue: 'in_person' },
        reason: DataTypes.TEXT
      };
      options.indexes = [
        { fields: ['patientId'] },
        { fields: ['doctorId'] },
        { fields: ['appointmentDate'] }
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
      
    case 'AuditLog':
      attributes = {
        ...attributes,
        userId: DataTypes.UUID,
        action: DataTypes.STRING,
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

  // Créer le modèle avec sequelize.define
  const Model = sequelize.define(modelName, attributes, options);
  db[Model.name] = Model;
  console.log(`✅ Modèle ${modelName} créé dynamiquement`);
}

// ✅ VÉRIFIER LES MODÈLES CRITIQUES
const criticalModels = ['User', 'Appointment', 'MedicalFile', 'Payment', 'Notification', 'Calendar'];
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

  // User ↔ AuditLog
  if (db.User && db.AuditLog) {
    db.User.hasMany(db.AuditLog, { as: 'auditLogs', foreignKey: 'userId' });
    db.AuditLog.belongsTo(db.User, { as: 'user', foreignKey: 'userId' });
    console.log('✅ Associations User-AuditLog');
  }
}

// Exécuter les associations
setupAssociations();

// ✅ SYNCHRONISATION SANS ALTER (CRITIQUE)
const syncModels = async () => {
  try {
    await sequelize.sync({ 
      alter: false,  // ← NE PAS MODIFIER LA STRUCTURE EXISTANTE
      force: false,
      logging: false
    });
    console.log('✅ Modèles synchronisés avec la base de données');
    return true;
  } catch (error) {
    console.error('❌ Erreur synchronisation:', error.message);
    
    // Tentative sans options
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
