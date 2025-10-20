const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'carnet_sante',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  }
);

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données PostgreSQL établie avec succès.');
    return true; // ⚠️ IMPORTANT: Retourner true en cas de succès
  } catch (error) {
    console.error('❌ Impossible de se connecter à la base de données:', error.message);
    console.error('💡 Vérifiez que:');
    console.error('   - PostgreSQL est démarré');
    console.error('   - La base de données "' + process.env.DB_NAME + '" existe');
    console.error('   - L\'utilisateur "' + process.env.DB_USER + '" a les droits');
    console.error('   - Le mot de passe est correct');
    console.error('   - Le port ' + process.env.DB_PORT + ' est accessible');
    return false;
  }
};

module.exports = { sequelize, testConnection };