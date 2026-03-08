// models/DoctorPayment.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DoctorPayment = sequelize.define('DoctorPayment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  processedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'XOF'
  },
  paymentMethod: {
    type: DataTypes.ENUM('bank_transfer', 'mobile_money', 'cash', 'check'),
    allowNull: false
  },
  // Détails selon la méthode
  // bank_transfer: { bankName, accountNumber, iban }
  // mobile_money:  { provider, phoneNumber }
  // cash/check:    { reference }
  paymentDetails: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  period: {
    type: DataTypes.STRING, // ex: "Mars 2026"
    allowNull: true
  },
  // Nombre de consultations couverts
  consultationsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'DoctorPayments',
  indexes: [
    { fields: ['doctorId'] },
    { fields: ['status'] },
    { fields: ['processedBy'] }
  ]
});

DoctorPayment.associate = function(models) {
  DoctorPayment.belongsTo(models.User, { as: 'doctor',    foreignKey: 'doctorId'    });
  DoctorPayment.belongsTo(models.User, { as: 'processor', foreignKey: 'processedBy' });
};

module.exports = DoctorPayment;
