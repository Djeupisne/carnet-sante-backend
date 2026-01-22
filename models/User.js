const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * Génération de code unique SYNCHRONE
 */
function generateUniqueCode(role) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  
  const prefixes = {
    patient: 'PAT',
    doctor: 'DOC', 
    admin: 'ADM',
    hospital_admin: 'HAD'
  };
  
  const prefix = prefixes[role] || 'USR';
  return `${prefix}${timestamp}${random}`.toUpperCase();
}

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  uniqueCode: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    defaultValue: () => generateUniqueCode('patient')
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('patient', 'doctor', 'admin', 'hospital_admin'),
    allowNull: false,
    defaultValue: 'patient'
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dateOfBirth: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  gender: {
    type: DataTypes.ENUM('male', 'female', 'other'),
    allowNull: true
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  bloodType: {
    type: DataTypes.ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'),
    allowNull: true
  },
  emergencyContact: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  specialty: {
    type: DataTypes.STRING,
    allowNull: true
  },
  licenseNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  biography: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  languages: {
    type: DataTypes.JSONB,
    defaultValue: [],
    allowNull: true
  },
  consultationPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  availability: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  resetToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  resetTokenExpiry: {
    type: DataTypes.DATE,
    allowNull: true
  },
  emailVerificationToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  emailVerifiedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  profileCompleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  profilePicture: {
    type: DataTypes.STRING,
    allowNull: true
  },
  timezone: {
    type: DataTypes.STRING,
    defaultValue: 'Europe/Paris'
  },
  preferences: {
    type: DataTypes.JSONB,
    defaultValue: {
      notifications: {
        email: true,
        sms: false,
        push: true
      },
      language: 'fr',
      theme: 'light'
    }
  },
  lastPasswordChange: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  },
  loginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lockUntil: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'Users',
  indexes: [
    {
      fields: ['email'],
      unique: true
    },
    {
      fields: ['uniqueCode'],
      unique: true
    },
    {
      fields: ['role', 'isActive']
    }
  ],
  hooks: {
    beforeCreate: async (user) => {
      try {
        console.log('Hook beforeCreate - User:', user.email, 'Role:', user.role);
        
        // Générer le code unique si manquant
        if (!user.uniqueCode) {
          user.uniqueCode = generateUniqueCode(user.role);
          console.log('Code unique généré:', user.uniqueCode);
        }
        
        // Hasher le mot de passe
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 12);
          console.log('Mot de passe hashé avec succès');
        }

        // Gérer seulement les conversions nécessaires
        if (user.role === 'doctor') {
          // Pour les médecins, s'assurer que languages est un tableau
          if (!user.languages || !Array.isArray(user.languages)) {
            user.languages = [];
          }
          console.log('Champs doctor initialisés');
        }

        // Nettoyer bloodType si vide
        if (user.bloodType === '' || user.bloodType === null) {
          user.bloodType = null;
        }

        console.log('✅ Hooks beforeCreate terminés avec succès');

      } catch (error) {
        console.error('❌ Erreur dans beforeCreate:', error);
        throw error;
      }
    },
    
    beforeUpdate: async (user) => {
      try {
        if (user.changed('password')) {
          console.log('Hook beforeUpdate - Hachage du nouveau mot de passe');
          user.password = await bcrypt.hash(user.password, 12);
        }

        // Logique de nettoyage simplifiée
        if (user.changed('role')) {
          if (user.role === 'patient') {
            // Nettoyer seulement si explicitement changé en patient
            user.specialty = null;
            user.licenseNumber = null;
            user.biography = null;
            user.languages = null;
            user.consultationPrice = 0.00;
          } else if (user.role === 'doctor') {
            if (!user.languages || !Array.isArray(user.languages)) {
              user.languages = [];
            }
          }
        }

        // Nettoyer bloodType si vide
        if (user.changed('bloodType') && (user.bloodType === '' || user.bloodType === null)) {
          user.bloodType = null;
        }

      } catch (error) {
        console.error('❌ Erreur dans beforeUpdate:', error);
        throw error;
      }
    }
  }
});

/**
 * MÉTHODE ASSOCIATE (AJOUT CRITIQUE)
 */
User.associate = function(models) {
  if (models.Appointment) {
    User.hasMany(models.Appointment, { 
      as: 'patientAppointments',
      foreignKey: 'patientId' 
    });
    
    User.hasMany(models.Appointment, { 
      as: 'doctorAppointments',
      foreignKey: 'doctorId' 
    });
  }
};

/**
 * Méthode pour vérifier le mot de passe
 */
User.prototype.comparePassword = async function(candidatePassword) {
  try {
    if (!this.password || !candidatePassword) {
      return false;
    }
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('❌ Erreur lors de la comparaison du mot de passe:', error);
    return false;
  }
};

/**
 * Méthode pour vérifier si le compte est verrouillé
 */
User.prototype.isLocked = function() {
  if (!this.lockUntil) {
    return false;
  }
  return new Date(this.lockUntil) > new Date();
};

/**
 * Méthode pour incrémenter les tentatives de connexion
 */
User.prototype.incLoginAttempts = async function() {
  try {
    // Si le compte est déverrouillé, réinitialiser les tentatives
    if (this.lockUntil && new Date(this.lockUntil) < new Date()) {
      return await this.update({
        loginAttempts: 1,
        lockUntil: null
      });
    }
    
    const attempts = (this.loginAttempts || 0) + 1;
    let lockUntil = null;
    
    // Verrouiller après 5 tentatives échouées
    if (attempts >= 5) {
      lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      console.log('⚠️ Compte verrouillé après 5 tentatives échouées');
    }
    
    return await this.update({
      loginAttempts: attempts,
      lockUntil
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'incrémentation des tentatives:', error);
    throw error;
  }
};

/**
 * Méthode pour réinitialiser les tentatives de connexion
 */
User.prototype.resetLoginAttempts = async function() {
  return await this.update({
    loginAttempts: 0,
    lockUntil: null
  });
};

module.exports = User;
