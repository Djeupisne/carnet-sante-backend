const { sequelize } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

async function addMissingFields() {
  try {
    console.log('🔄 Ajout des champs manquants...');
    
    // Vérifier si les champs existent déjà
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Users' AND column_name IN (
        'biography', 'languages', 'consultationPrice', 'availability',
        'emailVerificationToken', 'emailVerifiedAt', 'profileCompleted',
        'profilePicture', 'timezone', 'preferences', 'lastPasswordChange'
      )
    `;
    
    const existingColumns = await sequelize.query(checkQuery, { type: sequelize.QueryTypes.SELECT });
    const existingColumnNames = existingColumns.map(col => col.column_name);
    
    console.log('Colonnes existantes:', existingColumnNames);
    
    // Ajouter les champs manquants
    const alterQueries = [
      `ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "biography" TEXT`,
      `ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "languages" JSONB DEFAULT '[]'`,
      `ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "consultationPrice" DECIMAL(10,2) DEFAULT 0.00`,
      `ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "availability" JSONB DEFAULT '{}'`,
      `ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "emailVerificationToken" VARCHAR(255)`,
      `ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP`,
      `ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "profileCompleted" BOOLEAN DEFAULT false`,
      `ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "profilePicture" VARCHAR(255)`,
      `ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(50) DEFAULT 'Europe/Paris'`,
      `ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "preferences" JSONB DEFAULT '{"notifications":{"email":true,"sms":false,"push":true},"language":"fr","theme":"light"}'`,
      `ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "lastPasswordChange" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
    ];
    
    for (const query of alterQueries) {
      await sequelize.query(query);
      console.log(`✅ ${query.substring(0, 60)}...`);
    }
    
    console.log('🎉 Tous les champs ont été ajoutés avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout des champs:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  addMissingFields();
}

module.exports = addMissingFields;