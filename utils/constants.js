module.exports = {
  // Rôles utilisateur
  ROLES: {
    PATIENT: 'patient',
    DOCTOR: 'doctor',
    ADMIN: 'admin',
    HOSPITAL_ADMIN: 'hospital_admin'
  },

  // Statuts des rendez-vous
  APPOINTMENT_STATUS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_SHOW: 'no_show'
  },

  // Types de dossiers médicaux
  MEDICAL_RECORD_TYPES: {
    CONSULTATION: 'consultation',
    LAB_RESULT: 'lab_result',
    PRESCRIPTION: 'prescription',
    VACCINATION: 'vaccination',
    ALLERGY: 'allergy',
    SURGERY: 'surgery',
    HOSPITALIZATION: 'hospitalization',
    CHRONIC_DISEASE: 'chronic_disease',
    FAMILY_HISTORY: 'family_history'
  },

  // Méthodes de paiement
  PAYMENT_METHODS: {
    CARD: 'card',
    MOBILE_MONEY: 'mobile_money',
    BANK_TRANSFER: 'bank_transfer',
    CASH: 'cash'
  },

  // Types de notification
  NOTIFICATION_TYPES: {
    APPOINTMENT_REMINDER: 'appointment_reminder',
    NEW_MESSAGE: 'new_message',
    MEDICAL_RESULT: 'medical_result',
    PAYMENT_CONFIRMATION: 'payment_confirmation',
    SECURITY_ALERT: 'security_alert',
    SYSTEM_ANNOUNCEMENT: 'system_announcement'
  },

  // Groupes sanguins
  BLOOD_TYPES: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],

  // Spécialités médicales
  MEDICAL_SPECIALTIES: [
    'Médecine générale',
    'Cardiologie',
    'Dermatologie',
    'Gynécologie',
    'Pédiatrie',
    'Psychiatrie',
    'Radiologie',
    'Chirurgie',
    'Dentiste',
    'Ophtalmologie',
    'ORL',
    'Neurologie'
  ],

  // Configurations de sécurité
  SECURITY: {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_TIME: 15 * 60 * 1000, // 15 minutes
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 heures
    PASSWORD_MIN_LENGTH: 6,
    JWT_EXPIRY: '7d'
  },

  // Configurations de l'application
  APP: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    ITEMS_PER_PAGE: 20,
    MAX_ITEMS_PER_PAGE: 100
  }
};