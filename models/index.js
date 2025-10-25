const { sequelize } = require('../config/database');
const User = require('./User');
const Appointment = require('./Appointment');

// Définir les associations SANS alias pour éviter les conflits
User.hasMany(Appointment, { 
  foreignKey: 'patientId' 
});

User.hasMany(Appointment, { 
  foreignKey: 'doctorId' 
});

Appointment.belongsTo(User, { 
  foreignKey: 'patientId' 
});

Appointment.belongsTo(User, { 
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