const { User, MedicalFile, Appointment, Payment } = require('../models');
const { sequelize } = require('../config/database');
const { logger } = require('../utils/logger');

class Seeder {
  constructor() {
    this.users = [];
    this.medicalFiles = [];
    this.appointments = [];
    this.payments = [];
  }

  async seed() {
    try {
      console.log('🌱 Démarrage du seeding...');

      // Vider les tables (attention en production!)
      if (process.env.NODE_ENV !== 'production') {
        await this.cleanDatabase();
      }

      // Créer les données de test
      await this.createUsers();
      await this.createMedicalFiles();
      await this.createAppointments();
      await this.createPayments();

      console.log('🎉 Seeding terminé avec succès');
      
    } catch (error) {
      console.error('❌ Erreur lors du seeding:', error);
      logger.error('Erreur de seeding', { error: error.message });
      process.exit(1);
    }
  }

  async cleanDatabase() {
    console.log('🧹 Nettoyage de la base de données...');
    
    // Désactiver les contraintes
    await sequelize.query('SET session_replication_role = replica;');
    
    // Vider les tables dans l'ordre pour respecter les contraintes
    await Payment.destroy({ where: {}, force: true });
    await MedicalFile.destroy({ where: {}, force: true });
    await Appointment.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
    
    // Réactiver les contraintes
    await sequelize.query('SET session_replication_role = origin;');
  }

  async createUsers() {
    console.log('👥 Création des utilisateurs...');

    const usersData = [
      // Admin
      {
        uniqueCode: 'ADM001',
        email: 'admin@carnetsante.com',
        password: 'password123',
        role: 'admin',
        firstName: 'Admin',
        lastName: 'Système',
        dateOfBirth: '1980-01-01',
        gender: 'male',
        phoneNumber: '+33123456789',
        isVerified: true
      },
      // Médecins
      {
        uniqueCode: 'DOC001',
        email: 'dr.martin@carnetsante.com',
        password: 'password123',
        role: 'doctor',
        firstName: 'Pierre',
        lastName: 'Martin',
        dateOfBirth: '1975-05-15',
        gender: 'male',
        phoneNumber: '+33123456790',
        specialty: 'Médecine générale',
        licenseNumber: 'MED123456',
        isVerified: true
      },
      {
        uniqueCode: 'DOC002',
        email: 'dr.bernard@carnetsante.com',
        password: 'password123',
        role: 'doctor',
        firstName: 'Marie',
        lastName: 'Bernard',
        dateOfBirth: '1982-08-22',
        gender: 'female',
        phoneNumber: '+33123456791',
        specialty: 'Cardiologie',
        licenseNumber: 'MED123457',
        isVerified: true
      },
      // Patients
      {
        uniqueCode: 'PAT001',
        email: 'patient.dupont@carnetsante.com',
        password: 'password123',
        role: 'patient',
        firstName: 'Jean',
        lastName: 'Dupont',
        dateOfBirth: '1990-03-10',
        gender: 'male',
        phoneNumber: '+33123456792',
        bloodType: 'A+',
        isVerified: true
      },
      {
        uniqueCode: 'PAT002',
        email: 'patient.durand@carnetsante.com',
        password: 'password123',
        role: 'patient',
        firstName: 'Sophie',
        lastName: 'Durand',
        dateOfBirth: '1985-12-05',
        gender: 'female',
        phoneNumber: '+33123456793',
        bloodType: 'O+',
        isVerified: true
      }
    ];

    this.users = await User.bulkCreate(usersData);
    console.log(`✅ ${this.users.length} utilisateurs créés`);
  }

  async createMedicalFiles() {
    console.log('📁 Création des dossiers médicaux...');

    const patient1 = this.users.find(u => u.uniqueCode === 'PAT001');
    const patient2 = this.users.find(u => u.uniqueCode === 'PAT002');
    const doctor1 = this.users.find(u => u.uniqueCode === 'DOC001');

    const medicalFilesData = [
      {
        patientId: patient1.id,
        doctorId: doctor1.id,
        recordType: 'consultation',
        title: 'Consultation de routine',
        description: 'Consultation de contrôle annuel',
        diagnosis: 'État de santé général satisfaisant',
        symptoms: ['Fatigue légère'],
        medications: [
          { name: 'Vitamine D', dosage: '1000 UI', frequency: 'quotidien' }
        ],
        vitalSigns: {
          bloodPressure: '120/80',
          heartRate: 72,
          temperature: 36.8
        },
        consultationDate: new Date('2024-01-15')
      },
      {
        patientId: patient2.id,
        doctorId: doctor1.id,
        recordType: 'consultation',
        title: 'Suivi cardiologique',
        description: 'Consultation de suivi post-traitement',
        diagnosis: 'Amélioration des symptômes',
        symptoms: ['Palpitations occasionnelles'],
        medications: [
          { name: 'Bêta-bloquant', dosage: '25mg', frequency: 'quotidien' }
        ],
        vitalSigns: {
          bloodPressure: '130/85',
          heartRate: 68,
          temperature: 36.6
        },
        consultationDate: new Date('2024-01-20')
      }
    ];

    this.medicalFiles = await MedicalFile.bulkCreate(medicalFilesData);
    console.log(`✅ ${this.medicalFiles.length} dossiers médicaux créés`);
  }

  async createAppointments() {
    console.log('📅 Création des rendez-vous...');

    const patient1 = this.users.find(u => u.uniqueCode === 'PAT001');
    const patient2 = this.users.find(u => u.uniqueCode === 'PAT002');
    const doctor1 = this.users.find(u => u.uniqueCode === 'DOC001');
    const doctor2 = this.users.find(u => u.uniqueCode === 'DOC002');

    const appointmentsData = [
      {
        patientId: patient1.id,
        doctorId: doctor1.id,
        appointmentDate: new Date('2024-02-01T10:00:00'),
        duration: 30,
        status: 'confirmed',
        type: 'in_person',
        reason: 'Consultation de suivi pour fatigue persistante'
      },
      {
        patientId: patient2.id,
        doctorId: doctor2.id,
        appointmentDate: new Date('2024-02-02T14:30:00'),
        duration: 45,
        status: 'pending',
        type: 'teleconsultation',
        reason: 'Examen cardiologique de routine'
      }
    ];

    this.appointments = await Appointment.bulkCreate(appointmentsData);
    console.log(`✅ ${this.appointments.length} rendez-vous créés`);
  }

  async createPayments() {
    console.log('💳 Création des paiements...');

    const paymentData = this.appointments.map(appointment => ({
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      amount: appointment.duration === 30 ? 50 : 75,
      commission: appointment.duration === 30 ? 5 : 7.5,
      status: 'completed',
      paymentMethod: 'card',
      transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5)}`.toUpperCase(),
      paymentDate: new Date()
    }));

    this.payments = await Payment.bulkCreate(paymentData);
    console.log(`✅ ${this.payments.length} paiements créés`);
  }
}

// Exécuter le seeding si le script est appelé directement
if (require.main === module) {
  const seeder = new Seeder();
  seeder.seed();
}

module.exports = Seeder;