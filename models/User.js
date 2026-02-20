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

/**
 * Prix de base par spécialité (à partir de 25€)
 */
const SPECIALTY_PRICES = {
  'Généraliste': 25,
  'Médecine générale': 25,
  'Cardiologie': 45,
  'Dermatologie': 40,
  'Neurologie': 55,
  'Pédiatrie': 35,
  'Gynécologie': 40,
  'Ophtalmologie': 45,
  'ORL': 35,
  'Psychiatrie': 50,
  'Psychologue': 45,
  'Dentiste': 35,
  'Chirurgien': 60,
  'Radiologue': 50,
  'Anesthésiste': 55,
  'Urgentiste': 40,
  'Rhumatologue': 45,
  'Endocrinologue': 45,
  'Gastro-entérologue': 45,
  'Urologue': 45,
  'Néphrologue': 45,
  'Pneumologue': 45,
  'Hématologue': 45,
  'Oncologue': 55,
  'Médecin du sport': 35,
  'Nutritionniste': 30,
  'Kinésithérapeute': 30,
  'Orthophoniste': 30,
  'Podologue': 30,
  'Ostéopathe': 40,
  'Acupuncteur': 35,
  'Homéopathe': 30,
  'Médecin esthétique': 50,
  'Médecin du travail': 35,
  'Médecin scolaire': 30,
  'Médecin légiste': 45,
  'Allergologue': 40,
  'Immunologue': 45,
  'Infectiologue': 45,
  'Médecin interniste': 45,
  'Gériatre': 40,
  'Médecin palliatif': 40,
  'Médecin de la douleur': 45,
  'Médecin du sommeil': 45,
  'Médecin vasculaire': 45,
  'Médecin nucléaire': 55,
  'Généticien': 55,
  'Pharmacologue': 45,
  'Médecin tropical': 40,
  'Médecin militaire': 35
};

/**
 * Fonction pour obtenir le prix en fonction de la spécialité
 */
function getPriceForSpecialty(specialty) {
  if (!specialty) return 25; // Prix minimum par défaut
  
  // Nettoyer la spécialité (enlever les espaces, normaliser)
  const cleanSpecialty = specialty.trim();
  
  // Chercher une correspondance exacte
  if (SPECIALTY_PRICES[cleanSpecialty]) {
    return SPECIALTY_PRICES[cleanSpecialty];
  }
  
  // Chercher une correspondance partielle
  for (const [key, price] of Object.entries(SPECIALTY_PRICES)) {
    if (cleanSpecialty.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(cleanSpecialty.toLowerCase())) {
      return price;
    }
  }
  
  // Prix minimum par défaut si aucune correspondance
  return 25;
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
    defaultValue: 25.00, // Prix minimum par défaut
    validate: {
      min: 0
    }
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
        console.log('Données reçues dans hook:', {
          specialty: user.specialty,
          licenseNumber: user.licenseNumber,
          biography: user.biography,
          languages: user.languages
        });
        
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

        // ✅ FORMATAGE DES LANGUES
        if (user.languages) {
          if (typeof user.languages === 'string') {
            try {
              user.languages = JSON.parse(user.languages);
            } catch (e) {
              user.languages = [user.languages];
            }
          }
          if (!Array.isArray(user.languages)) {
            user.languages = [];
          }
        } else if (user.role === 'doctor') {
          user.languages = [];
        }

        // ✅ DÉFINIR LE PRIX EN FONCTION DE LA SPÉCIALITÉ POUR LES MÉDECINS
        if (user.role === 'doctor' && user.specialty) {
          // Si le prix n'est pas défini ou est à 0, utiliser le prix basé sur la spécialité
          if (!user.consultationPrice || user.consultationPrice === 0) {
            const calculatedPrice = getPriceForSpecialty(user.specialty);
            user.consultationPrice = calculatedPrice;
            console.log(`💰 Prix défini pour spécialité "${user.specialty}": ${calculatedPrice}€`);
          }
        } else if (user.role !== 'doctor') {
          // Pour les non-médecins, prix à 0
          user.consultationPrice = 0;
        }

        // Nettoyer bloodType si vide
        if (user.bloodType === '' || user.bloodType === null) {
          user.bloodType = null;
        }

        console.log('✅ Hooks beforeCreate terminés avec succès');
        console.log('💰 Consultation price final:', user.consultationPrice);

      } catch (error) {
        console.error('❌ Erreur dans beforeCreate:', error);
        throw error;
      }
    },
    
    beforeUpdate: async (user) => {
      try {
        console.log('Hook beforeUpdate - User:', user.email, 'Changements:', user.changed());
        console.log('Rôle actuel:', user.role);
        
        if (user.changed('password')) {
          console.log('Hook beforeUpdate - Hachage du nouveau mot de passe');
          user.password = await bcrypt.hash(user.password, 12);
        }

        // ✅ METTRE À JOUR LE PRIX SI LA SPÉCIALITÉ CHANGE
        if (user.role === 'doctor' && user.changed('specialty') && user.specialty) {
          const calculatedPrice = getPriceForSpecialty(user.specialty);
          user.consultationPrice = calculatedPrice;
          console.log(`💰 Prix mis à jour pour nouvelle spécialité "${user.specialty}": ${calculatedPrice}€`);
        }

        // ✅ FORMATAGE DES LANGUES
        if (user.changed('languages') && user.languages) {
          if (typeof user.languages === 'string') {
            try {
              user.languages = JSON.parse(user.languages);
            } catch (e) {
              user.languages = [user.languages];
            }
          }
          if (!Array.isArray(user.languages)) {
            user.languages = [];
          }
        }

        // Nettoyer bloodType si vide
        if (user.changed('bloodType') && (user.bloodType === '' || user.bloodType === null)) {
          user.bloodType = null;
        }

        console.log('✅ beforeUpdate terminé');

      } catch (error) {
        console.error('❌ Erreur dans beforeUpdate:', error);
        throw error;
      }
    }
  }
});

/**
 * MÉTHODE ASSOCIATE
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
