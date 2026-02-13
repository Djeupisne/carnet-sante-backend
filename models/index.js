const { sequelize } = require('../config/database');
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes, Op } = require('sequelize'); // IMPORTANT: Importer Op ici

const basename = path.basename(__filename);
const db = {};

// ✅ LISTE DES MODÈLES À IGNORER (pour éviter les conflits)
const ignoreFiles = ['Calendar.js']; // On va charger Calendar manuellement

// Import automatique de tous les modèles
fs.readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1 &&
      !ignoreFiles.includes(file) // Ignorer Calendar pour l'instant
    );
  })
  .forEach(file => {
    try {
      const modelDefiner = require(path.join(__dirname, file));
      
      // ✅ CORRECTION: Appeler la fonction avec sequelize
      if (typeof modelDefiner === 'function') {
        const model = modelDefiner(sequelize, DataTypes);
        if (model && model.name) {
          db[model.name] = model;
          console.log(`✅ Modèle chargé: ${model.name}`);
        }
      } else if (modelDefiner && modelDefiner.name) {
        // Pour les modèles déjà définis
        db[modelDefiner.name] = modelDefiner;
        console.log(`✅ Modèle chargé: ${modelDefiner.name}`);
      } else {
        console.warn(`⚠️ Modèle ${file} n'est pas une fonction ou n'a pas de propriété 'name'`);
      }
    } catch (error) {
      console.error(`❌ Erreur lors du chargement du modèle ${file}:`, error.message);
    }
  });

// ✅ CHARGER LE MODÈLE CALENDAR MANUELLEMENT (CRITIQUE)
try {
  const calendarPath = path.join(__dirname, 'Calendar.js');
  if (fs.existsSync(calendarPath)) {
    const calendarModelDefiner = require(calendarPath);
    if (typeof calendarModelDefiner === 'function') {
      const Calendar = calendarModelDefiner(sequelize, DataTypes);
      if (Calendar && Calendar.name) {
        db[Calendar.name] = Calendar;
        console.log(`✅ Modèle chargé: ${Calendar.name}`);
      }
    }
  } else {
    console.warn('⚠️ Fichier Calendar.js non trouvé, création du modèle par défaut...');
    
    // ✅ CRÉER LE MODÈLE CALENDAR DYNAMIQUEMENT S'IL N'EXISTE PAS
    const Calendar = sequelize.define('Calendar', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      date: {
        type: DataTypes.STRING, // Garder STRING pour éviter les erreurs de migration
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
    
    db.Calendar = Calendar;
    console.log('✅ Modèle Calendar créé dynamiquement');
  }
} catch (error) {
  console.error('❌ Erreur lors du chargement de Calendar:', error.message);
}

console.log('🔍 Modèles chargés dans db:', Object.keys(db));

// VÉRIFIER LES MODÈLES CRITIQUES
const criticalModels = ['User', 'Appointment', 'Payment', 'AuditLog', 'Calendar'];
criticalModels.forEach(modelName => {
  if (!db[modelName]) {
    console.error(`❌ MODÈLE CRITIQUE MANQUANT: ${modelName}`);
  }
});

// ✅ DÉFINIR LES ASSOCIATIONS
const setupAssociations = () => {
  // Associations User ↔ Appointment
  if (db.User && db.Appointment) {
    try {
      db.User.hasMany(db.Appointment, { 
        as: 'patientAppointments',
        foreignKey: 'patientId' 
      });
      
      db.User.hasMany(db.Appointment, { 
        as: 'doctorAppointments',
        foreignKey: 'doctorId' 
      });
      
      db.Appointment.belongsTo(db.User, { 
        as: 'patient',
        foreignKey: 'patientId' 
      });
      
      db.Appointment.belongsTo(db.User, { 
        as: 'doctor',
        foreignKey: 'doctorId' 
      });
      
      console.log('✅ Associations définies entre User et Appointment');
    } catch (assocError) {
      console.error('❌ Erreur associations User-Appointment:', assocError.message);
    }
  }

  // Associations Payment ↔ Appointment
  if (db.Payment && db.Appointment) {
    try {
      db.Payment.belongsTo(db.Appointment, {
        foreignKey: 'appointmentId',
        as: 'appointment'
      });
      
      db.Appointment.hasOne(db.Payment, {
        foreignKey: 'appointmentId',
        as: 'payment'
      });
      
      console.log('✅ Associations définies entre Appointment et Payment');
    } catch (error) {
      console.warn('⚠️ Erreur associations Payment:', error.message);
    }
  }

  // ✅ NOUVELLES ASSOCIATIONS: User ↔ Calendar
  if (db.User && db.Calendar) {
    try {
      db.User.hasMany(db.Calendar, {
        as: 'calendars',
        foreignKey: 'doctorId'
      });
      
      db.Calendar.belongsTo(db.User, {
        as: 'doctor',
        foreignKey: 'doctorId'
      });
      
      console.log('✅ Associations définies entre User et Calendar');
    } catch (error) {
      console.warn('⚠️ Erreur associations Calendar:', error.message);
    }
  }

  // ✅ ASSOCIATIONS: Appointment ↔ Calendar (optionnel)
  // Pas d'association directe, on utilise la date et doctorId pour la logique métier
};

// Exécuter les associations
setupAssociations();

// ✅ VERSION CORRIGÉE: Synchronisation SANS alter:true pour éviter les erreurs de migration
const syncModels = async () => {
  try {
    // ⚠️ NE PAS UTILISER alter:true - ça cause des erreurs de casting
    await sequelize.sync({ 
      alter: false,  // ← CRITIQUE: false pour éviter les erreurs de migration
      force: false,
      logging: false
    });
    console.log('✅ Modèles synchronisés avec la base de données (sans migration forcée)');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation des modèles:', error.message);
    
    // Tentative de synchronisation sans alter
    try {
      await sequelize.sync({ force: false, logging: false });
      console.log('✅ Modèles synchronisés (mode secours)');
      return true;
    } catch (fallbackError) {
      console.error('❌ Échec de la synchronisation:', fallbackError.message);
      return false;
    }
  }
};

// ✅ VERSION ALTERNATIVE: Créer la table Calendar si elle n'existe pas
const ensureCalendarTable = async () => {
  if (db.Calendar) {
    try {
      await db.Calendar.sync({ force: false, alter: false });
      console.log('✅ Table Calendar vérifiée');
    } catch (error) {
      console.error('❌ Erreur vérification table Calendar:', error.message);
    }
  }
};

// Exporter tous les modèles et fonctions - AVEC Op BIEN EXPORTÉ
module.exports = {
  ...db,
  sequelize,
  Sequelize,
  DataTypes,
  Op, // ✅ EXPORTÉ CORRECTEMENT
  syncModels,
  ensureCalendarTable
};

// Ajouter un log pour confirmer l'export
console.log('✅ models/index.js chargé avec succès');
console.log('🔍 Modèles exportés:', Object.keys(db));
console.log('🔍 Op exporté?', typeof Op !== 'undefined' ? 'OUI' : 'NON');
console.log('🔍 Calendar présent?', db.Calendar ? '✅ OUI' : '❌ NON');
