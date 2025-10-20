module.exports = {
  ROLES: {
    PATIENT: 'patient',
    DOCTOR: 'doctor',
    ADMIN: 'admin',
    HOSPITAL_ADMIN: 'hospital_admin'
  },
  
  APPOINTMENT_STATUS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_SHOW: 'no_show'
  },
  
  PAYMENT_STATUS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded'
  },
  
  MEDICAL_RECORD_TYPES: {
    CONSULTATION: 'consultation',
    LAB_RESULT: 'lab_result',
    PRESCRIPTION: 'prescription',
    VACCINATION: 'vaccination',
    ALLERGY: 'allergy',
    SURGERY: 'surgery',
    HOSPITALIZATION: 'hospitalization'
  },
  
  NOTIFICATION_TYPES: {
    APPOINTMENT_REMINDER: 'appointment_reminder',
    NEW_MESSAGE: 'new_message',
    MEDICAL_RESULT: 'medical_result',
    PAYMENT_CONFIRMATION: 'payment_confirmation',
    SECURITY_ALERT: 'security_alert'
  },
  
  SECURITY: {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_TIME: 15 * 60 * 1000, // 15 minutes
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000 // 24 heures
  }
};