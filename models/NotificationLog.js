const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const NotificationLog = sequelize.define('NotificationLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  notificationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Notifications',
      key: 'id'
    }
  },
  appointmentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Appointments',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  channel: {
    type: DataTypes.ENUM('email', 'sms', 'push'),
    allowNull: false
  },
  recipient: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'delivered', 'failed', 'bounced'),
    defaultValue: 'pending'
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: true
  },
  providerId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'NotificationLogs',
  indexes: [
    { fields: ['userId'] },
    { fields: ['appointmentId'] },
    { fields: ['status'] },
    { fields: ['createdAt'] }
  ]
});

NotificationLog.associate = function(models) {
  NotificationLog.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user'
  });
  NotificationLog.belongsTo(models.Appointment, {
    foreignKey: 'appointmentId',
    as: 'appointment'
  });
  NotificationLog.belongsTo(models.Notification, {
    foreignKey: 'notificationId',
    as: 'notification'
  });
};

module.exports = NotificationLog;
