const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,  // ✅ MODIFIÉ : Permet les valeurs null pour les admins sans compte en base
    references: {
      model: 'Users',
      key: 'id'
    },
    onDelete: 'SET NULL',  // ✅ AJOUTÉ : Si un utilisateur est supprimé, met null au lieu d'échouer
    onUpdate: 'CASCADE'
  },
  userRole: {
    type: DataTypes.ENUM('patient', 'doctor', 'admin', 'hospital_admin')
  },
  ipAddress: {
    type: DataTypes.STRING
  },
  userAgent: {
    type: DataTypes.TEXT
  },
  resource: {
    type: DataTypes.STRING
  },
  resourceId: {
    type: DataTypes.UUID
  },
  details: {
    type: DataTypes.JSONB
  },
  status: {
    type: DataTypes.ENUM('success', 'failure'),
    defaultValue: 'success'
  },
  errorMessage: {
    type: DataTypes.TEXT
  }
}, {
  indexes: [
    {
      fields: ['userId', 'createdAt']
    },
    {
      fields: ['action']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = AuditLog;
