const crypto = require('crypto');

class Helpers {
  // Générer un code unique
  generateUniqueCode(prefix = 'PAT') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}${timestamp}${random}`.toUpperCase();
  }

  // Formater une date pour l'affichage
  formatDate(date, includeTime = true) {
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };

    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }

    return new Date(date).toLocaleDateString('fr-FR', options);
  }

  // Calculer l'âge à partir de la date de naissance
  calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  // Valider un numéro de téléphone
  validatePhoneNumber(phone) {
    const phoneRegex = /^(\+33|0)[1-9](\d{2}){4}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  // Sanitizer les données utilisateur
  sanitizeUserInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .trim()
      .replace(/[<>]/g, '')
      .substring(0, 255);
  }

  // Générer un mot de passe aléatoire
  generateRandomPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }

  // Pagination helper
  getPaginationParams(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
    const offset = (page - 1) * limit;
    
    return { page, limit, offset };
  }

  // Formater les erreurs Sequelize
  formatSequelizeErrors(error) {
    if (error.name === 'SequelizeValidationError') {
      return error.errors.map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
    }
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return error.errors.map(err => ({
        field: err.path,
        message: 'Doit être unique',
        value: err.value
      }));
    }
    
    return [{ message: error.message }];
  }
}

module.exports = new Helpers();