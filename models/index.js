const { sequelize } = require('../config/database');
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes, Op } = require('sequelize');

const basename = path.basename(__filename);
const db = {};

// ✅ IMPORTANT: Charger d'abord les modèles existants avec la bonne syntaxe
const modelFiles = [
  'User',
  'Appointment',
  'Payment',
  'AuditLog',
  'MedicalFile',
  'Notification',
  'Review',
  'Calendar'
];

// Charger chaque modèle manuellement avec le bon pattern
modelFiles.forEach(modelName => {
  try {
    const modelPath = path.join(__dirname, `${modelName}.js`);
    
    if (fs.existsSync(modelPath)) {
      const modelDefiner = require(modelPath);
      
      // ✅ Vérifier le type du modèle et l'initialiser correctement
      if (typeof modelDefiner === 'function') {
        // Modèle défini comme fonction (module.exports = (sequelize) => {...})
        const model = modelDefiner(sequelize, DataTypes);
        if (model && model.name) {
          db[model.name] = model;
          console.log(`✅ Modèle chargé: ${model.name}`);
        }
      } else if (modelDefiner.prototype && modelDefiner.prototype.constructor) {
        // Modèle défini comme classe (extends Model)
        modelDefiner.init(modelDefiner.attributes, {
          sequelize,
          modelName: modelName,
          tableName: modelDefiner.options?.tableName || `${modelName}s`
        });
        db[modelDefiner.name] = modelDefiner;
        console.log(`✅ Modèle chargé: ${modelDefiner.name} (classe)`);
      } else if (modelDefiner.name) {
        // Modèle déjà initialisé
        db[modelDefiner.name] = modelDefiner;
        console.log(`✅ Modèle chargé: ${modelDefiner.name}`);
      }
    }
  } catch (error) {
    console.error(`❌ Erreur lors du chargement de ${modelName}:`, error.message);
  }
});

console.log('🔍 Modèles chargés dans db:', Object.keys(db));

// ✅ CRÉER LE MODÈLE CALENDAR DYNAMIQUEMENT S'IL N'EXISTE PAS
if (!db.Calendar) {
  console.log('📅 Création dynamique du modèle Calendar...');
  
  const Calendar = sequelize.define('Calendar', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    date: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slots: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    },
    confirmed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    doctorId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    versions: {
      type: DataTypes.JSON,
      defaultValue: [],
    }
  }, {
    tableName: 'Calendars',
    indexes: [
      {
        unique: true,
        fields: ['doctorId', 'date']
      }
    ]
  });
  
  db.Calendar = Calendar;
  console.log('✅ Modèle Calendar créé dynamiquement');
}

// ✅ VÉRIFIER LES MODÈLES CRITIQUES
const criticalModels = ['User', 'Appointment', 'Payment', 'AuditLog', 'Calendar', 'MedicalFile', 'Notification', 'Review'];
criticalModels.forEach(modelName => {
  if (!db[modelName]) {
    console.error(`❌ MODÈLE CRITIQUE MANQUANT: ${modelName}`);
  }
});

// ✅ DÉFINIR LES ASSOCIATIONS
const setupAssociations = () => {
  // User ↔ Appointment
  if (db.User && db.Appointment) {
    try {
      db.User.hasMany(db.Appointment, { as: 'patientAppointments', foreignKey: 'patientId' });
      db.User.hasMany(db.Appointment, { as: 'doctorAppointments', foreignKey: 'doctorId' });
      db.Appointment.belongsTo(db.User, { as: 'patient', foreignKey: 'patientId' });
      db.Appointment.belongsTo(db.User, { as: 'doctor', foreignKey: 'doctorId' });
      console.log('✅ Associations User-Appointment OK');
    } catch (e) { console.warn('⚠️ Erreur User-Appointment:', e.message); }
  }

  // Payment ↔ Appointment
  if (db.Payment && db.Appointment) {
    try {
      db.Payment.belongsTo(db.Appointment, { foreignKey: 'appointmentId', as: 'appointment' });
      db.Appointment.hasOne(db.Payment, { foreignKey: 'appointmentId', as: 'payment' });
      console.log('✅ Associations Payment-Appointment OK');
    } catch (e) { console.warn('⚠️ Erreur Payment-Appointment:', e.message); }
  }

  // User ↔ Calendar
  if (db.User && db.Calendar) {
    try {
      db.User.hasMany(db.Calendar, { as: 'calendars', foreignKey: 'doctorId' });
      db.Calendar.belongsTo(db.User, { as: 'doctor', foreignKey: 'doctorId' });
      console.log('✅ Associations User-Calendar OK');
    } catch (e) { console.warn('⚠️ Erreur User-Calendar:', e.message); }
  }

  // User ↔ MedicalFile
  if (db.User && db.MedicalFile) {
    try {
      db.User.hasOne(db.MedicalFile, { as: 'medicalFile', foreignKey: 'patientId' });
      db.MedicalFile.belongsTo(db.User, { as: 'patient', foreignKey: 'patientId' });
      console.log('✅ Associations User-MedicalFile OK');
    } catch (e) { console.warn('⚠️ Erreur User-MedicalFile:', e.message); }
  }

  // User ↔ Notification
  if (db.User && db.Notification) {
    try {
      db.User.hasMany(db.Notification, { as: 'notifications', foreignKey: 'userId' });
      db.Notification.belongsTo(db.User, { as: 'user', foreignKey: 'userId' });
      console.log('✅ Associations User-Notification OK');
    } catch (e) { console.warn('⚠️ Erreur User-Notification:', e.message); }
  }

  // User ↔ Review
  if (db.User && db.Review) {
    try {
      db.User.hasMany(db.Review, { as: 'reviews', foreignKey: 'doctorId' });
      db.Review.belongsTo(db.User, { as: 'doctor', foreignKey: 'doctorId' });
      console.log('✅ Associations User-Review OK');
    } catch (e) { console.warn('⚠️ Erreur User-Review:', e.message); }
  }

  // User ↔ AuditLog
  if (db.User && db.AuditLog) {
    try {
      db.User.hasMany(db.AuditLog, { as: 'auditLogs', foreignKey: 'userId' });
      db.AuditLog.belongsTo(db.User, { as: 'user', foreignKey: 'userId' });
      console.log('✅ Associations User-AuditLog OK');
    } catch (e) { console.warn('⚠️ Erreur User-AuditLog:', e.message); }
  }
};

// Exécuter les associations
setupAssociations();

// ✅ SYNCHRONISATION SANS ALTER (CRITIQUE)
const syncModels = async () => {
  try {
    await sequelize.sync({ 
      alter: false,  // ← CRITIQUE: NE PAS MODIFIER LA STRUCTURE EXISTANTE
      force: false,
      logging: false
    });
    console.log('✅ Modèles synchronisés avec la base de données');
    return true;
  } catch (error) {
    console.error('❌ Erreur synchronisation:', error.message);
    
    // Tentative sans alter
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

// Exporter
module.exports = {
  ...db,
  sequelize,
  Sequelize,
  DataTypes,
  Op,
  syncModels
};

console.log('✅ models/index.js chargé avec succès');
console.log('🔍 Modèles exportés:', Object.keys(db));
console.log('🔍 Op exporté?', typeof Op !== 'undefined' ? 'OUI' : 'NON');
console.log('🔍 Calendar présent?', db.Calendar ? '✅ OUI' : '❌ NON');
