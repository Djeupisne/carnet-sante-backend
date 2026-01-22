const { sequelize } = require('../config/database');
const fs = require('fs');
const path = require('path');

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
    const model = require(path.join(__dirname, file));
    db[model.name] = model;
    console.log(`✅ Modèle chargé: ${model.name}`);
  });

// Vérifier les modèles chargés
console.log('🔍 Modèles chargés:', Object.keys(db));

// DÉFINIR LES ASSOCIATIONS MANUELLEMENT
if (db.User && db.Appointment) {
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

// Exporter tous les modèles et fonctions
module.exports = {
  ...db,
  sequelize,
  syncModels,
  Op: require('sequelize').Op // Exporter Op pour les requêtes
};
