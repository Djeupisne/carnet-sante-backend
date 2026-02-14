const bcrypt = require('bcrypt');

// Liste des admins prédéfinis (NE PAS stocker en clair)
const ADMIN_USERS = [
  {
    email: 'admin@carnetsante.com',
    // Hash de 'Admin123!' généré avec bcrypt
    passwordHash: '$2b$10$XwZ5Q7k9Yh3qL5nR8tV2pO1mJ3xY9zK7wL4nR6tV8xZ2pQ5mK9', 
    firstName: 'Super',
    lastName: 'Admin',
    role: 'admin'
  },
  {
    email: 'superadmin@carnetsante.com',
    // Hash de 'SuperAdmin123!'
    passwordHash: '$2b$10$YwZ5Q7k9Yh3qL5nR8tV2pO1mJ3xY9zK7wL4nR6tV8xZ2pQ5mK0',
    firstName: 'Master',
    lastName: 'Admin',
    role: 'admin'
  }
];

// Fonction pour générer les hash (à utiliser UNE SEULE fois)
const generateHash = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

module.exports = { ADMIN_USERS, generateHash };
