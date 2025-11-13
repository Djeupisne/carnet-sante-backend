const { sequelize } = require('../config/database');
const User = require('./User');
const Appointment = require('./Appointment');

// ✅ Associations AVEC alias obligatoires pour différencier patient et docteur
User.hasMany(Appointment, { 
  as: 'patientAppointments',  // ← Alias OBLIGATOIRE
  foreignKey: 'patientId' 
});

User.hasMany(Appointment, { 
  as: 'doctorAppointments',   // ← Alias OBLIGATOIRE et DIFFÉRENT
  foreignKey: 'doctorId' 
});

Appointment.belongsTo(User, { 
  as: 'patient',              // ← Alias OBLIGATOIRE (utilisé dans le controller)
  foreignKey: 'patientId' 
});

Appointment.belongsTo(User, { 
  as: 'doctor',               // ← Alias OBLIGATOIRE (utilisé dans le controller)
  foreignKey: 'doctorId' 
});

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

module.exports = {
  sequelize,
  User,
  Appointment,
  syncModels
};