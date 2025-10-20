const NodeCache = require('node-cache');
const { logger } = require('../utils/logger');

class CacheService {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 600, // 10 minutes par défaut
      checkperiod: 120 // Vérification toutes les 2 minutes
    });
  }

  set(key, value, ttl = 600) {
    try {
      const success = this.cache.set(key, value, ttl);
      if (success) {
        logger.debug('Cache mis à jour', { key, ttl });
      }
      return success;
    } catch (error) {
      logger.error('Erreur lors de la mise en cache', { key, error: error.message });
      return false;
    }
  }

  get(key) {
    try {
      const value = this.cache.get(key);
      if (value) {
        logger.debug('Cache hit', { key });
      }
      return value;
    } catch (error) {
      logger.error('Erreur lors de la récupération du cache', { key, error: error.message });
      return null;
    }
  }

  del(key) {
    try {
      const deleted = this.cache.del(key);
      if (deleted > 0) {
        logger.debug('Cache supprimé', { key });
      }
      return deleted;
    } catch (error) {
      logger.error('Erreur lors de la suppression du cache', { key, error: error.message });
      return 0;
    }
  }

  flush() {
    try {
      this.cache.flushAll();
      logger.debug('Cache vidé');
    } catch (error) {
      logger.error('Erreur lors du vidage du cache', { error: error.message });
    }
  }

  // Méthodes spécifiques au domaine
  cacheUser(user) {
    const key = `user:${user.id}`;
    return this.set(key, user, 3600); // 1 heure pour les utilisateurs
  }

  getCachedUser(userId) {
    const key = `user:${userId}`;
    return this.get(key);
  }

  cacheDoctorsList(doctors) {
    const key = 'doctors:list';
    return this.set(key, doctors, 1800); // 30 minutes pour la liste des médecins
  }

  getCachedDoctorsList() {
    const key = 'doctors:list';
    return this.get(key);
  }
}

module.exports = new CacheService();