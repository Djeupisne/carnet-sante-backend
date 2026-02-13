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
  // ✅ CORRIGÉ - Ajout de tous les types de notifications pour les rendez-vous
  type: {
    type: DataTypes.ENUM(
      // Notifications de rendez-vous
      'new_appointment',
      'appointment_confirmed',
      'appointment_cancelled',
      'appointment_completed',
      'appointment_reminder',
      'appointment_update',
      
      // Autres notifications
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
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // ✅ CORRIGÉ - Gardé comme ENUM car c'est standard
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
  tableName: 'Notifications',
  indexes: [
    {
      fields: ['userId']
    },
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
