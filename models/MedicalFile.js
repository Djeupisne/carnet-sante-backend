const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MedicalFile = sequelize.define('MedicalFile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  recordType: {
    type: DataTypes.ENUM(
      'consultation',
      'lab_result',
      'prescription',
      'vaccination',
      'allergy',
      'surgery',
      'hospitalization',
      'chronic_disease',
      'family_history'
    ),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  diagnosis: {
    type: DataTypes.TEXT
  },
  symptoms: {
    type: DataTypes.JSONB
  },
  medications: {
    type: DataTypes.JSONB
  },
  labResults: {
    type: DataTypes.JSONB
  },
  vitalSigns: {
    type: DataTypes.JSONB
  },
  attachments: {
    type: DataTypes.JSONB
  },
  consultationDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  nextAppointment: {
    type: DataTypes.DATE
  },
  isCritical: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isShared: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  accessLog: {
    type: DataTypes.JSONB,
    defaultValue: []
  }
}, {
  indexes: [
    {
      fields: ['patientId', 'consultationDate']
    },
    {
      fields: ['recordType']
    },
    {
      fields: ['isCritical']
    }
  ]
});

module.exports = MedicalFile;