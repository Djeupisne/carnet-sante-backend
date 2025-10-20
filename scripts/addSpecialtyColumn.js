const { sequelize } = require('../config/database');

async function addSpecialtyColumn() {
  try {
    console.log('🔄 Ajout de la colonne specialty...');
    
    // Vérifier si la colonne existe déjà
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Users' AND column_name = 'specialty'
    `;
    
    const existingColumns = await sequelize.query(checkQuery, { type: sequelize.QueryTypes.SELECT });
    
    if (existingColumns.length === 0) {
      // Ajouter la colonne specialty
      await sequelize.query(`ALTER TABLE "Users" ADD COLUMN "specialty" VARCHAR(100)`);
      console.log('✅ Colonne "specialty" ajoutée avec succès');
    } else {
      console.log('✅ Colonne "specialty" existe déjà');
    }
    
    // Vérifier et ajouter licenseNumber si nécessaire
    const checkLicenseQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Users' AND column_name = 'licenseNumber'
    `;
    
    const existingLicense = await sequelize.query(checkLicenseQuery, { type: sequelize.QueryTypes.SELECT });
    
    if (existingLicense.length === 0) {
      await sequelize.query(`ALTER TABLE "Users" ADD COLUMN "licenseNumber" VARCHAR(100)`);
      console.log('✅ Colonne "licenseNumber" ajoutée avec succès');
    } else {
      console.log('✅ Colonne "licenseNumber" existe déjà');
    }
    
    console.log('🎉 Toutes les colonnes nécessaires sont présentes !');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout des colonnes:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  addSpecialtyColumn();
}

module.exports = addSpecialtyColumn;