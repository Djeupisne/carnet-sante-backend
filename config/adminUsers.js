const ADMIN_USERS = [
  {
    id: 'admin-1',
    email: 'admin@carnetsante.com',
    // Remplacez ce hash par celui généré par le script
    passwordHash: '$2a$12$7/qHrWkNkXjgcwHfgm4i0..jjxjr.noa7rEDTbY2aRG7/Gx6dYMGO',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'admin'
  },
  {
    id: 'admin-2',
    email: 'superadmin@carnetsante.com',
    // Remplacez ce hash par celui généré par le script
    passwordHash: '$2a$12$cVt52.Vu3/xPvq1oMH3cjO8a3oIJIWgUJ5KplKFmR0Lri5bfrhMbi',
    firstName: 'Master',
    lastName: 'Admin',
    role: 'admin'
  }
];

module.exports = { ADMIN_USERS };
