const { sequelize } = require('../config/database');
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes, Op } = require('sequelize'); // IMPORTANT: Importer Op ici

const basename = path.basename(__filename);
const db = {};

// Import automatique de tous les modèles
fs.readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    try {
      const model = require(path.join(__dirname, file));
      
      // S'assurer que le modèle est correctement défini
      if (model && model.name) {
        db[model.name] = model;
        console.log(`✅ Modèle chargé: ${model.name}`);
      } else {
        console.warn(`⚠️ Modèle ${file} n'a pas de propriété 'name'`);
      }
    } catch (error) {
      console.error(`❌ Erreur lors du chargement du modèle ${file}:`, error.message);
    }
  });

console.log('🔍 Modèles chargés dans db:', Object.keys(db));

// VÉRIFIER LES MODÈLES CRITIQUES
const criticalModels = ['User', 'Appointment', 'Payment', 'AuditLog'];
criticalModels.forEach(modelName => {
  if (!db[modelName]) {
    console.error(`❌ MODÈLE CRITIQUE MANQUANT: ${modelName}`);
  }
});

// DÉFINIR LES ASSOCIATIONS MANUELLEMENT
if (db.User && db.Appointment) {
  try {
    // User associations
    db.User.hasMany(db.Appointment, { 
      as: 'patientAppointments',
      foreignKey: 'patientId' 
    });
    
    db.User.hasMany(db.Appointment, { 
      as: 'doctorAppointments',
      foreignKey: 'doctorId' 
    });
    
    // Appointment associations
    db.Appointment.belongsTo(db.User, { 
      as: 'patient',
      foreignKey: 'patientId' 
    });
    
    db.Appointment.belongsTo(db.User, { 
      as: 'doctor',
      foreignKey: 'doctorId' 
    });
    
    console.log('✅ Associations définies entre User et Appointment');
  } catch (assocError) {
    console.error('❌ Erreur lors de la définition des associations:', assocError.message);
  }
}

// Définir également les associations dans Payment si disponible
if (db.Payment && db.Appointment) {
  try {
    db.Payment.belongsTo(db.Appointment, {
      foreignKey: 'appointmentId',
      as: 'appointment'
    });
    
    db.Appointment.hasOne(db.Payment, {
      foreignKey: 'appointmentId',
      as: 'payment'
    });
    
    console.log('✅ Associations définies entre Appointment et Payment');
  } catch (error) {
    console.warn('⚠️ Erreur avec associations Payment:', error.message);
  }
}

// Synchroniser les modèles avec la base de données
const syncModels = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Modèles synchronisés avec la base de données');
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation des modèles:', error);
    throw error;
  }
};

// Exporter tous les modèles et fonctions - AVEC Op BIEN EXPORTÉ
module.exports = {
  ...db,
  sequelize,
  Sequelize,
  DataTypes,
  Op, // EXPORTÉ CORRECTEMENT
  syncModels
};

// Ajouter un log pour confirmer l'export
console.log('✅ models/index.js chargé avec succès');
console.log('🔍 Op exporté?', typeof Op !== 'undefined' ? 'OUI' : 'NON');
