const crypto = require('crypto');
const bcrypt = require('bcryptjs');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    // Utilisez une clé de 32 bytes (256 bits) ou générez-la
    this.key = process.env.ENCRYPTION_KEY 
      ? Buffer.from(process.env.ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32))
      : crypto.randomBytes(32);
  }

  /**
   * Chiffrer les données sensibles
   */
  encrypt(text) {
    try {
      if (!text) return null;

      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Retourner IV + données chiffrées
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Erreur lors du chiffrement:', error);
      return null;
    }
  }

  /**
   * Déchiffrer les données
   */
  decrypt(encryptedText) {
    try {
      if (!encryptedText) return null;

      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        throw new Error('Format de données chiffrées invalide');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Erreur lors du déchiffrement:', error);
      return null;
    }
  }

  /**
   * Générer un token de réinitialisation de mot de passe
   */
  generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Générer un code de vérification à 6 chiffres
   */
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Générer un code unique
   */
  generateUniqueCode(prefix = 'USR') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Hasher un mot de passe avec bcrypt
   */
  async hashPassword(password) {
    if (!password) throw new Error('Le mot de passe est requis');
    return await bcrypt.hash(password, 12);
  }

  /**
   * Comparer un mot de passe avec son hash
   */
  async comparePassword(password, hashedPassword) {
    if (!password || !hashedPassword) return false;
    return await bcrypt.compare(password, hashedPassword);
  }

  /**
   * Générer un token sécurisé aléatoire
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Valider le format d'un token
   */
  isValidToken(token) {
    if (!token || typeof token !== 'string') return false;
    return /^[a-f0-9]{64}$/.test(token); // Pour tokens de 32 bytes (64 caractères hex)
  }
}

module.exports = new EncryptionService();