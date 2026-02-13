const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Calendar = sequelize.define('Calendar', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    date: {
      type: DataTypes.STRING,
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

  Calendar.associate = function(models) {
    if (models.User) {
      Calendar.belongsTo(models.User, {
        as: 'doctor',
        foreignKey: 'doctorId'
      });
    }
  };

  return Calendar;
};
