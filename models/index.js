const User = require('./User');
const MedicalFile = require('./MedicalFile');
const Appointment = require('./Appointment');
const Payment = require('./Payment');
const Notification = require('./Notification');
const Review = require('./Review');
const AuditLog = require('./AuditLog');

// Définir les relations
User.hasMany(MedicalFile, { foreignKey: 'patientId', as: 'medicalFiles' });
MedicalFile.belongsTo(User, { foreignKey: 'patientId', as: 'medicalFilePatient' });
MedicalFile.belongsTo(User, { foreignKey: 'doctorId', as: 'medicalFileDoctor' });

User.hasMany(Appointment, { foreignKey: 'patientId', as: 'patientAppointments' });
User.hasMany(Appointment, { foreignKey: 'doctorId', as: 'doctorAppointments' });
Appointment.belongsTo(User, { foreignKey: 'patientId', as: 'appointmentPatient' });
Appointment.belongsTo(User, { foreignKey: 'doctorId', as: 'appointmentDoctor' });

Appointment.hasOne(Payment, { foreignKey: 'appointmentId', as: 'appointmentPayment' });
Payment.belongsTo(Appointment, { foreignKey: 'appointmentId', as: 'paymentAppointment' });
Payment.belongsTo(User, { foreignKey: 'patientId', as: 'paymentPatient' });
Payment.belongsTo(User, { foreignKey: 'doctorId', as: 'paymentDoctor' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'userNotifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'notificationUser' });

User.hasMany(Review, { foreignKey: 'patientId', as: 'patientReviews' });
User.hasMany(Review, { foreignKey: 'doctorId', as: 'doctorReviews' });
Review.belongsTo(User, { foreignKey: 'patientId', as: 'reviewPatient' });
Review.belongsTo(User, { foreignKey: 'doctorId', as: 'reviewDoctor' });

module.exports = {
  User,
  MedicalFile,
  Appointment,
  Payment,
  Notification,
  Review,
  AuditLog
};