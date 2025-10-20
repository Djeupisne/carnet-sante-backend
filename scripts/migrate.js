const { sequelize } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

class MigrationRunner {
  constructor() {
    this.migrationsPath = path.join(__dirname, '../migrations');
  }

  async runMigrations() {
    try {
      console.log('🚀 Démarrage des migrations...');

      // Lire les fichiers de migration dans l'ordre
      const migrationFiles = await fs.readdir(this.migrationsPath);
      const sqlFiles = migrationFiles
        .filter(file => file.endsWith('.sql'))
        .sort(); // Tri naturel par nom de fichier

      for (const file of sqlFiles) {
        console.log(`📋 Exécution de la migration: ${file}`);
        
        const filePath = path.join(this.migrationsPath, file);
        const sql = await fs.readFile(filePath, 'utf8');
        
        // Exécuter le script SQL
        await sequelize.query(sql);
        console.log(`✅ Migration ${file} exécutée avec succès`);
      }

      console.log('🎉 Toutes les migrations ont été exécutées avec succès');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'exécution des migrations:', error);
      logger.error('Erreur de migration', { error: error.message });
      process.exit(1);
    }
  }
}

// Exécuter les migrations si le script est appelé directement
if (require.main === module) {
  const runner = new MigrationRunner();
  runner.runMigrations();
}

module.exports = MigrationRunner;