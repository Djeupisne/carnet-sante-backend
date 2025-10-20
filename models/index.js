const User = require('./User');
const MedicalFile = require('./MedicalFile');
const Appointment = require('./Appointment');
const Payment = require('./Payment');
const Notification = require('./Notification');
const Review = require('./Review');
const AuditLog = require('./AuditLog');

// Définir les relations
User.hasMany(MedicalFile, { foreignKey: 'patientId', as: 'medicalFiles' });
MedicalFile.belongsTo(User, { foreignKey: 'patientId', as: 'patient' });
MedicalFile.belongsTo(User, { foreignKey: 'doctorId', as: 'doctor' });

User.hasMany(Appointment, { foreignKey: 'patientId', as: 'patientAppointments' });
User.hasMany(Appointment, { foreignKey: 'doctorId', as: 'doctorAppointments' });
Appointment.belongsTo(User, { foreignKey: 'patientId', as: 'patient' });
Appointment.belongsTo(User, { foreignKey: 'doctorId', as: 'doctor' });

Appointment.hasOne(Payment, { foreignKey: 'appointmentId', as: 'payment' });
Payment.belongsTo(Appointment, { foreignKey: 'appointmentId', as: 'appointment' });
Payment.belongsTo(User, { foreignKey: 'patientId', as: 'patient' });
Payment.belongsTo(User, { foreignKey: 'doctorId', as: 'doctor' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Review, { foreignKey: 'patientId', as: 'patientReviews' });
User.hasMany(Review, { foreignKey: 'doctorId', as: 'doctorReviews' });
Review.belongsTo(User, { foreignKey: 'patientId', as: 'patient' });
Review.belongsTo(User, { foreignKey: 'doctorId', as: 'doctor' });

module.exports = {
  User,
  MedicalFile,
  Appointment,
  Payment,
  Notification,
  Review,
  AuditLog
};