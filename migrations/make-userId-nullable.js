'use strict';

/**
 * Migration : Rendre la colonne userId nullable dans AuditLogs
 * 
 * Pourquoi : Les comptes admin configurés via variables d'environnement
 * n'existent pas dans la table Users, donc userId doit pouvoir être null
 * pour permettre l'enregistrement des logs d'audit admin.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Modifier la colonne userId pour permettre les valeurs NULL
    await queryInterface.changeColumn('AuditLogs', 'userId', {
      type: Sequelize.UUID,
      allowNull: true,  // ✅ Permet null
      references: {
        model: 'Users',
        key: 'id'
      },
      onDelete: 'SET NULL',  // Si un utilisateur est supprimé, met null
      onUpdate: 'CASCADE'
    });

    console.log('✅ Migration terminée : userId est maintenant nullable dans AuditLogs');
  },

  async down(queryInterface, Sequelize) {
    // Rollback : remettre userId en NOT NULL
    // ⚠️ ATTENTION : Cette opération échouera s'il existe des enregistrements avec userId = null
    
    // Optionnel : Supprimer d'abord les logs avec userId null
    // await queryInterface.sequelize.query(
    //   'DELETE FROM "AuditLogs" WHERE "userId" IS NULL'
    // );

    await queryInterface.changeColumn('AuditLogs', 'userId', {
      type: Sequelize.UUID,
      allowNull: false,  // Retour à NOT NULL
      references: {
        model: 'Users',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    console.log('⚠️ Rollback terminé : userId est de nouveau NOT NULL dans AuditLogs');
  }
};
