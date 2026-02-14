const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Toutes les routes admin nécessitent une authentification et le rôle admin
router.use(authenticateToken);
router.use(authorizeRole('admin'));

// Dashboard
router.get('/dashboard', adminController.getDashboardStats);

// Gestion complète des utilisateurs (médecins et patients)
router.get('/users', adminController.getUsers);                    // Liste avec filtres
router.get('/users/:id', adminController.getUserById);             // Détail d'un utilisateur
router.post('/users', adminController.createUser);                  // Créer un utilisateur
router.put('/users/:id', adminController.updateUser);               // Modifier un utilisateur
router.delete('/users/:id', adminController.deleteUser);            // Supprimer un utilisateur
router.patch('/users/:id/toggle-status', adminController.toggleUserStatus); // Activer/désactiver
router.patch('/users/:userId/status', adminController.updateUserStatus); // Ancienne route (garder pour compatibilité)

// Gestion des rendez-vous (vue admin)
router.get('/appointments', adminController.getAllAppointments);    // Tous les rendez-vous
router.get('/appointments/:id', adminController.getAppointmentById); // Détail d'un rendez-vous
router.delete('/appointments/:id', adminController.deleteAppointment); // Supprimer un rendez-vous

// Rapports financiers
router.get('/financial/reports', adminController.getFinancialReports);
router.get('/financial/doctor-stats', adminController.getDoctorFinancialStats);

// Audit logs
router.get('/audit-logs', adminController.getAuditLogs);
router.get('/audit-logs/user/:userId', adminController.getUserAuditLogs);

module.exports = router;
