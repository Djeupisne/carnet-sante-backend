const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User'); // ✅ correct
const Appointment = sequelize.define('Appointment', {
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
  appointmentDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER, // en minutes
    defaultValue: 30
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show'),
    defaultValue: 'pending'
  },
  type: {
    type: DataTypes.ENUM('in_person', 'teleconsultation', 'home_visit'),
    defaultValue: 'in_person'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  symptoms: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  meetingLink: {
    type: DataTypes.STRING
  },
  meetingPassword: {
    type: DataTypes.STRING
  },
  notes: {
    type: DataTypes.TEXT
  },
  cancellationReason: {
    type: DataTypes.TEXT
  },
  reminderSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  rating: {
    type: DataTypes.INTEGER,
    validate: {
      min: 1,
      max: 5
    }
  },
  feedback: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'Appointments',
  indexes: [
    {
      fields: ['patientId', 'appointmentDate']
    },
    {
      fields: ['doctorId', 'appointmentDate']
    },
    {
      fields: ['status']
    },
    {
      fields: ['appointmentDate']
    }
  ]
});

// Définir les associations
Appointment.belongsTo(User, { 
  as: 'patient', 
  foreignKey: 'patientId' 
});

Appointment.belongsTo(User, { 
  as: 'doctor', 
  foreignKey: 'doctorId' 
});

User.hasMany(Appointment, { 
  as: 'patientAppointments', 
  foreignKey: 'patientId' 
});

User.hasMany(Appointment, { 
  as: 'doctorAppointments', 
  foreignKey: 'doctorId' 
});

module.exports = Appointment;