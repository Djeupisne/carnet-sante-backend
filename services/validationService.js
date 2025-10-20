class ValidationService {
  /**
   * Valider l'enregistrement d'un utilisateur
   */
  validateUserRegistration(userData) {
    const errors = [];

    // Validation de l'email
    if (!userData.email || typeof userData.email !== 'string') {
      errors.push({ field: 'email', message: 'Email requis' });
    } else if (!this.isValidEmail(userData.email)) {
      errors.push({ field: 'email', message: 'Format d\'email invalide' });
    }

    // Validation du mot de passe
    if (!userData.password || typeof userData.password !== 'string') {
      errors.push({ field: 'password', message: 'Mot de passe requis' });
    } else if (userData.password.length < 6) {
      errors.push({ field: 'password', message: 'Le mot de passe doit contenir au moins 6 caractères' });
    } else if (userData.password.length > 128) {
      errors.push({ field: 'password', message: 'Le mot de passe est trop long' });
    }

    // Validation du prénom
    if (!userData.firstName || typeof userData.firstName !== 'string') {
      errors.push({ field: 'firstName', message: 'Prénom requis' });
    } else if (userData.firstName.trim().length < 2) {
      errors.push({ field: 'firstName', message: 'Le prénom doit contenir au moins 2 caractères' });
    } else if (userData.firstName.trim().length > 50) {
      errors.push({ field: 'firstName', message: 'Le prénom ne doit pas dépasser 50 caractères' });
    }

    // Validation du nom
    if (!userData.lastName || typeof userData.lastName !== 'string') {
      errors.push({ field: 'lastName', message: 'Nom requis' });
    } else if (userData.lastName.trim().length < 2) {
      errors.push({ field: 'lastName', message: 'Le nom doit contenir au moins 2 caractères' });
    } else if (userData.lastName.trim().length > 50) {
      errors.push({ field: 'lastName', message: 'Le nom ne doit pas dépasser 50 caractères' });
    }

    // Validation de la date de naissance
    if (!userData.dateOfBirth || typeof userData.dateOfBirth !== 'string') {
      errors.push({ field: 'dateOfBirth', message: 'Date de naissance requise' });
    } else if (!this.isValidDate(userData.dateOfBirth)) {
      errors.push({ field: 'dateOfBirth', message: 'Format de date invalide (YYYY-MM-DD)' });
    } else {
      const ageValidation = this.validateAge(userData.dateOfBirth);
      if (!ageValidation.isValid) {
        errors.push({ field: 'dateOfBirth', message: ageValidation.message });
      }
    }

    // Validation du genre
    if (!userData.gender || typeof userData.gender !== 'string') {
      errors.push({ field: 'gender', message: 'Genre requis' });
    } else if (!['male', 'female', 'other'].includes(userData.gender)) {
      errors.push({ field: 'gender', message: 'Genre invalide (male, female ou other)' });
    }

    // Validation du numéro de téléphone (optionnel)
    if (userData.phoneNumber) {
      if (typeof userData.phoneNumber !== 'string') {
        errors.push({ field: 'phoneNumber', message: 'Le numéro de téléphone doit être une chaîne' });
      } else if (!this.isValidPhoneNumber(userData.phoneNumber)) {
        errors.push({ field: 'phoneNumber', message: 'Format de numéro de téléphone invalide' });
      }
    }

    // Validation du rôle (optionnel, par défaut 'patient')
    if (userData.role) {
      if (!['patient', 'doctor', 'admin', 'hospital_admin'].includes(userData.role)) {
        errors.push({ field: 'role', message: 'Rôle invalide' });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Valider les données d'un dossier médical
   */
  validateMedicalRecord(recordData) {
    const errors = [];

    if (!recordData.patientId) {
      errors.push({ field: 'patientId', message: 'ID patient requis' });
    }

    if (!recordData.recordType) {
      errors.push({ field: 'recordType', message: 'Type de dossier requis' });
    }

    if (!recordData.title || recordData.title.trim().length < 5) {
      errors.push({ field: 'title', message: 'Titre doit contenir au moins 5 caractères' });
    }

    if (!recordData.consultationDate) {
      errors.push({ field: 'consultationDate', message: 'Date de consultation requise' });
    } else if (!this.isValidDate(recordData.consultationDate)) {
      errors.push({ field: 'consultationDate', message: 'Format de date invalide' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Valider les données d'un rendez-vous
   */
  validateAppointment(appointmentData) {
    const errors = [];

    if (!appointmentData.doctorId) {
      errors.push({ field: 'doctorId', message: 'ID médecin requis' });
    }

    if (!appointmentData.appointmentDate) {
      errors.push({ field: 'appointmentDate', message: 'Date de rendez-vous requise' });
    } else if (!this.isValidDate(appointmentData.appointmentDate)) {
      errors.push({ field: 'appointmentDate', message: 'Format de date invalide' });
    }

    if (!appointmentData.reason || appointmentData.reason.trim().length < 10) {
      errors.push({ field: 'reason', message: 'Motif de consultation doit contenir au moins 10 caractères' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Valider les données de paiement
   */
  validatePayment(paymentData) {
    const errors = [];

    if (!paymentData.appointmentId) {
      errors.push({ field: 'appointmentId', message: 'ID rendez-vous requis' });
    }

    if (!paymentData.amount || paymentData.amount <= 0) {
      errors.push({ field: 'amount', message: 'Montant doit être supérieur à 0' });
    }

    if (!paymentData.paymentMethod || !['card', 'bank_transfer', 'mobile_money'].includes(paymentData.paymentMethod)) {
      errors.push({ field: 'paymentMethod', message: 'Méthode de paiement invalide' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Valider un mot de passe
   */
  validatePassword(password) {
    const errors = [];

    if (!password || typeof password !== 'string') {
      errors.push({ message: 'Mot de passe requis' });
    } else if (password.length < 6) {
      errors.push({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
    } else if (password.length > 128) {
      errors.push({ message: 'Le mot de passe est trop long' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Vérifier si un email est valide
   */
  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  /**
   * Vérifier si une date est valide
   */
  isValidDate(dateString) {
    if (!dateString || typeof dateString !== 'string') return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Vérifier si l'âge est valide (18-120 ans)
   */
  validateAge(dateOfBirth) {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      return { isValid: false, message: 'Vous devez avoir au moins 18 ans' };
    }

    if (age > 120) {
      return { isValid: false, message: 'Date de naissance invalide' };
    }

    return { isValid: true, age };
  }

  /**
   * Vérifier si un numéro de téléphone est valide
   */
  isValidPhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') return false;
    // Accepte formats: +33123456789, 0123456789, +33 1 23 45 67 89
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    const cleanPhone = phoneNumber.replace(/\s/g, '').replace(/[-()]/g, '');
    return phoneRegex.test(phoneNumber) && cleanPhone.length >= 10 && /^\d+$/.test(cleanPhone);
  }

  /**
   * Valider les données de connexion
   */
  validateLogin(data) {
    const errors = [];

    if (!data.email || !this.isValidEmail(data.email)) {
      errors.push({ field: 'email', message: 'Email invalide' });
    }

    if (!data.password || typeof data.password !== 'string' || data.password.length < 1) {
      errors.push({ field: 'password', message: 'Mot de passe requis' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = new ValidationService();