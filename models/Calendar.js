const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// ✅ Définition DIRECTE du modèle (pas de factory function)
const Calendar = sequelize.define('Calendar', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  date: {
    type: DataTypes.STRING,  // ✅ Garder STRING pour éviter les erreurs de migration
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
    references: {
      model: 'Users',
      key: 'id'
    }
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

// ✅ Association (sera appelée par models/index.js)
Calendar.associate = function(models) {
  if (models.User) {
    Calendar.belongsTo(models.User, {
      as: 'doctor',
      foreignKey: 'doctorId'
    });
  }
};

module.exports = Calendar;
