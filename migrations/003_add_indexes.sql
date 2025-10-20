-- Index pour les performances des requêtes fréquentes

-- Recherche d'utilisateurs
CREATE INDEX idx_users_email ON "Users" (email);
CREATE INDEX idx_users_role ON "Users" (role);
CREATE INDEX idx_users_active ON "Users" (isActive) WHERE isActive = true;

-- Recherche de dossiers médicaux
CREATE INDEX idx_medicalfiles_patient ON "MedicalFiles" (patientId);
CREATE INDEX idx_medicalfiles_doctor ON "MedicalFiles" (doctorId);
CREATE INDEX idx_medicalfiles_date ON "MedicalFiles" (consultationDate);
CREATE INDEX idx_medicalfiles_type ON "MedicalFiles" (recordType);
CREATE INDEX idx_medicalfiles_critical ON "MedicalFiles" (isCritical) WHERE isCritical = true;

-- Recherche de rendez-vous
CREATE INDEX idx_appointments_patient ON "Appointments" (patientId);
CREATE INDEX idx_appointments_doctor ON "Appointments" (doctorId);
CREATE INDEX idx_appointments_date ON "Appointments" (appointmentDate);
CREATE INDEX idx_appointments_status ON "Appointments" (status);
CREATE INDEX idx_appointments_patient_status ON "Appointments" (patientId, status);
CREATE INDEX idx_appointments_doctor_status ON "Appointments" (doctorId, status);

-- Recherche de paiements
CREATE INDEX idx_payments_patient ON "Payments" (patientId);
CREATE INDEX idx_payments_doctor ON "Payments" (doctorId);
CREATE INDEX idx_payments_status ON "Payments" (status);
CREATE INDEX idx_payments_date ON "Payments" (paymentDate);
CREATE INDEX idx_payments_transaction ON "Payments" (transactionId);

-- Recherche de notifications
CREATE INDEX idx_notifications_user ON "Notifications" (userId);
CREATE INDEX idx_notifications_read ON "Notifications" (isRead) WHERE isRead = false;
CREATE INDEX idx_notifications_type ON "Notifications" (type);
CREATE INDEX idx_notifications_scheduled ON "Notifications" (scheduledFor);

-- Recherche d'avis
CREATE INDEX idx_reviews_doctor ON "Reviews" (doctorId);
CREATE INDEX idx_reviews_patient ON "Reviews" (patientId);
CREATE INDEX idx_reviews_rating ON "Reviews" (rating);

-- Logs d'audit
CREATE INDEX idx_auditlogs_user ON "AuditLogs" (userId);
CREATE INDEX idx_auditlogs_action ON "AuditLogs" (action);
CREATE INDEX idx_auditlogs_date ON "AuditLogs" (createdAt);
CREATE INDEX idx_auditlogs_resource ON "AuditLogs" (resource, resourceId);

-- Index pour les recherches textuelles
CREATE INDEX idx_users_search ON "Users" 
USING gin ((
    to_tsvector('french', 
        COALESCE("firstName", '') || ' ' || 
        COALESCE("lastName", '') || ' ' || 
        COALESCE(email, '') || ' ' || 
        COALESCE("uniqueCode", '')
    )
));

CREATE INDEX idx_medicalfiles_search ON "MedicalFiles" 
USING gin ((
    to_tsvector('french', 
        COALESCE(title, '') || ' ' || 
        COALESCE(description, '') || ' ' || 
        COALESCE(diagnosis, '')
    )
));