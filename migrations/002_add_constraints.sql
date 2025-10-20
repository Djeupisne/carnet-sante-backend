-- Contraintes d'intégrité supplémentaires

-- Un utilisateur ne peut pas avoir deux rendez-vous au même moment
CREATE UNIQUE INDEX unique_doctor_appointment 
ON "Appointments" (doctorId, appointmentDate) 
WHERE status IN ('pending', 'confirmed');

-- Un patient ne peut pas avoir deux rendez-vous au même moment
CREATE UNIQUE INDEX unique_patient_appointment 
ON "Appointments" (patientId, appointmentDate) 
WHERE status IN ('pending', 'confirmed');

-- Un rendez-vous ne peut avoir qu'un seul paiement
CREATE UNIQUE INDEX unique_appointment_payment 
ON "Payments" (appointmentId);

-- Un patient ne peut noter qu'une fois un rendez-vous
CREATE UNIQUE INDEX unique_appointment_review 
ON "Reviews" (appointmentId);

-- Contrainte pour les emails uniques (case insensitive)
CREATE UNIQUE INDEX unique_email_lower 
ON "Users" (LOWER(email));

-- Contrainte pour les codes uniques (case insensitive)
CREATE UNIQUE INDEX unique_code_lower 
ON "Users" (LOWER("uniqueCode"));

-- Les médecins doivent avoir un numéro de licence
ALTER TABLE "Users" 
ADD CONSTRAINT doctor_license_required 
CHECK (
    (role != 'doctor') OR 
    (role = 'doctor' AND "licenseNumber" IS NOT NULL AND LENGTH(TRIM("licenseNumber")) > 0)
);