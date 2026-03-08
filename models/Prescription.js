// models/Prescription.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Prescription = sequelize.define('Prescription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  appointmentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Appointments', key: 'id' }
  },
  // [{ medication, dosage, frequency, duration, instructions }]
  medications: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'cancelled'),
    defaultValue: 'active'
  },
  validUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'Prescriptions',
  indexes: [
    { fields: ['patientId'] },
    { fields: ['doctorId'] },
    { fields: ['status'] }
  ]
});

Prescription.associate = function(models) {
  Prescription.belongsTo(models.User, { as: 'patient', foreignKey: 'patientId' });
  Prescription.belongsTo(models.User, { as: 'doctor',  foreignKey: 'doctorId'  });
};

module.exports = Prescription;
