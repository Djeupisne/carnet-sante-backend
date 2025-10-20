const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM(
      'appointment_reminder',
      'new_message',
      'medical_result',
      'payment_confirmation',
      'security_alert',
      'system_announcement'
    ),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  data: {
    type: DataTypes.JSONB
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  scheduledFor: {
    type: DataTypes.DATE
  },
  sentAt: {
    type: DataTypes.DATE
  }
}, {
  indexes: [
    {
      fields: ['userId', 'isRead']
    },
    {
      fields: ['type']
    },
    {
      fields: ['scheduledFor']
    }
  ]
});

module.exports = Notification;