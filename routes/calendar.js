// Dans votre server.js, remplacez la partie synchronisation par :

console.log('🔄 Synchronisation des modèles...');

// ✅ NE PAS FORCER LA MIGRATION - Garder la structure existante
await sequelize.sync({ 
  alter: false, // ← CRITIQUE: false pour éviter les erreurs de migration
  force: false,
  logging: false
});

console.log('✅ Modèles principaux synchronisés');

// ✅ NE PAS SYNCHRONISER Calendar séparément - il est déjà inclus dans sequelize.sync()
// SUPPRIMEZ ou COMMENTEZ ces lignes :
/*
try {
  const { Calendar } = require('./models/calendar');
  await Calendar.sync({ alter: true }); // ← SUPPRIMEZ cette ligne !
  console.log('✅ Modèle Calendar synchronisé avec succès');
} catch (calendarError) {
  console.error('❌ Erreur lors de la synchronisation du modèle Calendar:', calendarError.message);
}
*/
