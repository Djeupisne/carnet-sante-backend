'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Migration pour ajouter les colonnes manquantes à la table Users
     */
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('Exécution de la migration : ajout des colonnes manquantes');

      // Vérifier si la colonne resetToken existe
      const describeResult = await queryInterface.describeTable('Users', { transaction });
      const columnNames = Object.keys(describeResult);

      console.log('Colonnes existantes:', columnNames);

      // Ajouter resetToken si elle n'existe pas
      if (!columnNames.includes('resetToken')) {
        console.log('Ajout de la colonne resetToken...');
        await queryInterface.addColumn('Users', 'resetToken', {
          type: Sequelize.STRING,
          allowNull: true
        }, { transaction });
        console.log('✓ Colonne resetToken ajoutée');
      } else {
        console.log('Colonne resetToken existe déjà');
      }

      // Ajouter resetTokenExpiry si elle n'existe pas
      if (!columnNames.includes('resetTokenExpiry')) {
        console.log('Ajout de la colonne resetTokenExpiry...');
        await queryInterface.addColumn('Users', 'resetTokenExpiry', {
          type: Sequelize.DATE,
          allowNull: true
        }, { transaction });
        console.log('✓ Colonne resetTokenExpiry ajoutée');
      } else {
        console.log('Colonne resetTokenExpiry existe déjà');
      }

      // Ajouter emailVerificationToken si elle n'existe pas
      if (!columnNames.includes('emailVerificationToken')) {
        console.log('Ajout de la colonne emailVerificationToken...');
        await queryInterface.addColumn('Users', 'emailVerificationToken', {
          type: Sequelize.STRING,
          allowNull: true
        }, { transaction });
        console.log('✓ Colonne emailVerificationToken ajoutée');
      } else {
        console.log('Colonne emailVerificationToken existe déjà');
      }

      // Ajouter emailVerifiedAt si elle n'existe pas
      if (!columnNames.includes('emailVerifiedAt')) {
        console.log('Ajout de la colonne emailVerifiedAt...');
        await queryInterface.addColumn('Users', 'emailVerifiedAt', {
          type: Sequelize.DATE,
          allowValue: true
        }, { transaction });
        console.log('✓ Colonne emailVerifiedAt ajoutée');
      } else {
        console.log('Colonne emailVerifiedAt existe déjà');
      }

      // Ajouter uniqueCode si elle n'existe pas
      if (!columnNames.includes('uniqueCode')) {
        console.log('Ajout de la colonne uniqueCode...');
        await queryInterface.addColumn('Users', 'uniqueCode', {
          type: Sequelize.STRING,
          unique: true,
          allowNull: false,
          defaultValue: () => generateUniqueCode('patient')
        }, { transaction });
        console.log('✓ Colonne uniqueCode ajoutée');
      } else {
        console.log('Colonne uniqueCode existe déjà');
      }

      // Ajouter lastLogin si elle n'existe pas
      if (!columnNames.includes('lastLogin')) {
        console.log('Ajout de la colonne lastLogin...');
        await queryInterface.addColumn('Users', 'lastLogin', {
          type: Sequelize.DATE,
          allowNull: true
        }, { transaction });
        console.log('✓ Colonne lastLogin ajoutée');
      } else {
        console.log('Colonne lastLogin existe déjà');
      }

      // Ajouter loginAttempts si elle n'existe pas
      if (!columnNames.includes('loginAttempts')) {
        console.log('Ajout de la colonne loginAttempts...');
        await queryInterface.addColumn('Users', 'loginAttempts', {
          type: Sequelize.INTEGER,
          defaultValue: 0
        }, { transaction });
        console.log('✓ Colonne loginAttempts ajoutée');
      } else {
        console.log('Colonne loginAttempts existe déjà');
      }

      // Ajouter lockUntil si elle n'existe pas
      if (!columnNames.includes('lockUntil')) {
        console.log('Ajout de la colonne lockUntil...');
        await queryInterface.addColumn('Users', 'lockUntil', {
          type: Sequelize.DATE,
          allowNull: true
        }, { transaction });
        console.log('✓ Colonne lockUntil ajoutée');
      } else {
        console.log('Colonne lockUntil existe déjà');
      }

      await transaction.commit();
      console.log('✓ Migration complétée avec succès');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Erreur lors de la migration:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    /**
     * Rollback - supprimer les colonnes ajoutées
     */
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('Rollback de la migration');

      const columnsToRemove = [
        'resetToken',
        'resetTokenExpiry',
        'emailVerificationToken',
        'emailVerifiedAt',
        'uniqueCode',
        'lastLogin',
        'loginAttempts',
        'lockUntil'
      ];

      for (const column of columnsToRemove) {
        try {
          await queryInterface.removeColumn('Users', column, { transaction });
          console.log(`✓ Colonne ${column} supprimée`);
        } catch (error) {
          console.warn(`⚠️ Impossible de supprimer ${column}:`, error.message);
        }
      }

      await transaction.commit();
      console.log('✓ Rollback complété');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Erreur lors du rollback:', error.message);
      throw error;
    }
  }
};

/**
 * Fonction helper pour générer un code unique
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