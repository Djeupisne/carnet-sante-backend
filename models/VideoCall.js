// models/VideoCall.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VideoCall = sequelize.define('VideoCall', {
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
  roomLink: {
    type: DataTypes.STRING,
    allowNull: false
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // durée calculée en minutes
  durationMinutes: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'ongoing', 'completed', 'missed'),
    defaultValue: 'scheduled'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'VideoCalls',
  indexes: [
    { fields: ['patientId'] },
    { fields: ['doctorId'] },
    { fields: ['status'] }
  ]
});

VideoCall.associate = function(models) {
  VideoCall.belongsTo(models.User, { as: 'patient', foreignKey: 'patientId' });
  VideoCall.belongsTo(models.User, { as: 'doctor',  foreignKey: 'doctorId'  });
};

module.exports = VideoCall;
