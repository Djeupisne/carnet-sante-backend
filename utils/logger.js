const winston = require('winston');
const path = require('path');

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'carnet-sante-backend' },
  transports: [
    // Fichier pour toutes les logs
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/combined.log') 
    }),
    // Fichier pour les erreurs
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error'
    }),
    // Console en développement
    ...(process.env.NODE_ENV === 'development' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : [])
  ]
});

// Stream pour Morgan (logging HTTP)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = { logger };