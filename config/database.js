const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

if (process.env.DATABASE_URL) {
  console.log('🌐 Mode Production - DATABASE_URL détectée');
  
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 60000,
      idle: 10000
    }
  });
} else {
  console.log('💻 Mode Local - Variables séparées');
  
  sequelize = new Sequelize(
    process.env.DB_NAME || 'carnet_sante',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASS || 'password',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );
}

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion PostgreSQL réussie!');
    console.log('📊 Base:', sequelize.config.database);
    return true;
  } catch (error) {
    console.error('❌ Erreur connexion DB:', error.message);
    return false;
  }
};

module.exports = { sequelize, testConnection, Sequelize };