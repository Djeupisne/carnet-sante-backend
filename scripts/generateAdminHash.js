const bcrypt = require('bcryptjs');

const generateHash = async (password) => {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  console.log('=================================');
  console.log(`Mot de passe: ${password}`);
  console.log(`Hash généré: ${hash}`);
  console.log('=================================');
  return hash;
};

const run = async () => {
  console.log('🔐 GÉNÉRATION DES HASH ADMIN\n');
  
  const admin1Hash = await generateHash('Admin123!');
  const admin2Hash = await generateHash('SuperAdmin123!');
  
  console.log('\n📋 Copiez ces hash dans votre fichier config/adminUsers.js :\n');
  console.log(`{
    id: 'admin-1',
    email: 'admin@carnetsante.com',
    passwordHash: '${admin1Hash}',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'admin'
  },`);
  console.log(`{
    id: 'admin-2',
    email: 'superadmin@carnetsante.com',
    passwordHash: '${admin2Hash}',
    firstName: 'Master',
    lastName: 'Admin',
    role: 'admin'
  }`);
};

run().catch(console.error);
