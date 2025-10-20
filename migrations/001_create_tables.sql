-- Table des utilisateurs
CREATE TABLE "Users" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uniqueCode VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin', 'hospital_admin')),
    firstName VARCHAR(100) NOT NULL,
    lastName VARCHAR(100) NOT NULL,
    dateOfBirth DATE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    phoneNumber VARCHAR(20),
    address JSONB,
    bloodType VARCHAR(3) CHECK (bloodType IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    emergencyContact JSONB,
    specialty VARCHAR(100),
    licenseNumber VARCHAR(100),
    isVerified BOOLEAN DEFAULT false,
    isActive BOOLEAN DEFAULT true,
    lastLogin TIMESTAMP,
    loginAttempts INTEGER DEFAULT 0,
    lockUntil TIMESTAMP,
    resetToken VARCHAR(255),
    resetTokenExpiry TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des dossiers médicaux
CREATE TABLE "MedicalFiles" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patientId UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
    doctorId UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
    recordType VARCHAR(50) NOT NULL CHECK (recordType IN (
        'consultation', 'lab_result', 'prescription', 'vaccination',
        'allergy', 'surgery', 'hospitalization', 'chronic_disease', 'family_history'
    )),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    diagnosis TEXT,
    symptoms JSONB,
    medications JSONB,
    labResults JSONB,
    vitalSigns JSONB,
    attachments JSONB,
    consultationDate TIMESTAMP NOT NULL,
    nextAppointment TIMESTAMP,
    isCritical BOOLEAN DEFAULT false,
    isShared BOOLEAN DEFAULT false,
    accessLog JSONB DEFAULT '[]',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des rendez-vous
CREATE TABLE "Appointments" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patientId UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
    doctorId UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
    appointmentDate TIMESTAMP NOT NULL,
    duration INTEGER DEFAULT 30,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
    type VARCHAR(20) DEFAULT 'in_person' CHECK (type IN ('in_person', 'teleconsultation', 'home_visit')),
    reason TEXT NOT NULL,
    symptoms JSONB,
    meetingLink VARCHAR(500),
    meetingPassword VARCHAR(100),
    notes TEXT,
    cancellationReason TEXT,
    reminderSent BOOLEAN DEFAULT false,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des paiements
CREATE TABLE "Payments" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointmentId UUID NOT NULL REFERENCES "Appointments"(id) ON DELETE CASCADE,
    patientId UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
    doctorId UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    commission DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'EUR',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    paymentMethod VARCHAR(20) NOT NULL CHECK (paymentMethod IN ('card', 'mobile_money', 'bank_transfer', 'cash')),
    transactionId VARCHAR(100) UNIQUE,
    paymentDate TIMESTAMP,
    refundAmount DECIMAL(10,2) DEFAULT 0.00,
    refundReason TEXT,
    metadata JSONB,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des notifications
CREATE TABLE "Notifications" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userId UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'appointment_reminder', 'new_message', 'medical_result',
        'payment_confirmation', 'security_alert', 'system_announcement'
    )),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    isRead BOOLEAN DEFAULT false,
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    scheduledFor TIMESTAMP,
    sentAt TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des avis
CREATE TABLE "Reviews" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patientId UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
    doctorId UUID NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
    appointmentId UUID NOT NULL REFERENCES "Appointments"(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    professionalism INTEGER CHECK (professionalism >= 1 AND professionalism <= 5),
    communication INTEGER CHECK (communication >= 1 AND communication <= 5),
    waitingTime INTEGER CHECK (waitingTime >= 1 AND waitingTime <= 5),
    isVerified BOOLEAN DEFAULT false,
    isAnonymous BOOLEAN DEFAULT false,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des logs d'audit
CREATE TABLE "AuditLogs" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    userId UUID REFERENCES "Users"(id) ON DELETE SET NULL,
    userRole VARCHAR(20) CHECK (userRole IN ('patient', 'doctor', 'admin', 'hospital_admin')),
    ipAddress VARCHAR(45),
    userAgent TEXT,
    resource VARCHAR(100),
    resourceId UUID,
    details JSONB,
    status VARCHAR(10) DEFAULT 'success' CHECK (status IN ('success', 'failure')),
    errorMessage TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);