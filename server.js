require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

const { sequelize, testConnection } = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');

const app = express();

// Middleware de sécurité
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

// Compression Gzip
app.use(compression());

// CORS COMPLET - TOUTES LES AUTORISATIONS
app.use(cors({
  origin: function (origin, callback) {
    // En développement, autoriser toutes les origines
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // En production, utiliser les origines autorisées
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://192.168.47.233:3000',
      'http://192.168.224.1:3000',
      'http://192.168.200.1:3000'
    ];
    
    // Autoriser les requêtes sans origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚫 Origin bloqué par CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'X-API-Key'
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials'
  ],
  maxAge: 86400 // 24 heures
}));

// Gestion explicite des requêtes OPTIONS (preflight)
app.options('*', cors());

// Middleware de debug CORS (en développement)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log('🌐 CORS Debug:', {
      origin: req.headers.origin,
      method: req.method,
      url: req.url,
      headers: req.headers
    });
    
    // Headers CORS supplémentaires pour le développement
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 
      'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
    
    next();
  });
}

// Rate limiting plus permissif en développement
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Plus permissif en dev
  message: {
    success: false,
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Logging HTTP avec Morgan
app.use(morgan('combined', { 
  stream: logger.stream,
  skip: (req, res) => req.url === '/health' // Ne pas logger les health checks
}));

// Body parser middleware avec limites augmentées
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb',
  parameterLimit: 100000
}));

// Servir les fichiers statiques avec headers CORS
app.use('/uploads', express.static(path.join(__dirname, 'Uploads'), {
  setHeaders: (res, path) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Cache-Control', 'public, max-age=31536000');
  }
}));

// Servir les docs API si existantes
app.use('/api/docs', express.static(path.join(__dirname, 'docs')));

// Logging des requêtes personnalisé
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      origin: req.headers.origin,
      duration: duration
    });
  });
  
  next();
});

// Middleware de santé avancé
app.use('/health', (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

// Routes API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/medical-files', require('./routes/medicalFile'));
app.use('/api/appointments', require('./routes/appointment'));
app.use('/api/payments', require('./routes/payment'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/search', require('./routes/search'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/calendars', require('./routes/calendar'));
app.use('/api/users', require('./routes/users')); // Nouvelle route ajoutée

// Route de santé complète
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await testConnection();
    
    res.json({
      success: true,
      message: '🚀 Serveur Carnet de Santé en ligne',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: {
        status: dbStatus ? '✅ Connecté' : '❌ Erreur',
        type: 'PostgreSQL'
      },
      server: {
        port: process.env.PORT,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      },
      cors: {
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        currentOrigin: req.headers.origin
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: '⚠️ Serveur en difficulté',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Route racine avec informations détaillées
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏥 API Carnet de Santé Virtuel',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      profile: '/api/profile',
      medicalFiles: '/api/medical-files',
      appointments: '/api/appointments',
      payments: '/api/payments',
      admin: '/api/admin',
      search: '/api/search',
      notifications: '/api/notifications',
      users: '/api/users' // Ajouté
    },
    cors: {
      allowed: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true
    }
  });
});

// Route de test CORS
app.get('/api/cors-test', (req, res) => {
  res.json({
    success: true,
    message: '✅ Test CORS réussi !',
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    headers: req.headers
  });
});

// Middleware pour les routes non trouvées avec CORS
app.use('*', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Gestion des erreurs avec CORS
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log('🚀 Démarrage du serveur Carnet de Santé...');
    console.log('📁 Répertoire:', __dirname);
    
    // Tester la connexion à la base de données
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('❌ Impossible de se connecter à la base de données');
    }
    
    // Synchroniser les modèles (en développement seulement)
    console.log('🔄 Synchronisation des modèles...');
await sequelize.sync({ 
  alter: false, // Ne pas modifier les tables existantes
  force: false, // Ne JAMAIS supprimer les tables
  logging: false
});
console.log('✅ Modèles synchronisés');
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n🎉 SERVEUR DÉMARRÉ AVEC SUCCÈS!');
      console.log('=================================');
      console.log(`🌍 Environnement: ${process.env.NODE_ENV}`);
      console.log(`🔗 URL principale: http://localhost:${PORT}`);
      console.log(`🌐 URL réseau: http://0.0.0.0:${PORT}`);
      console.log(`❤️  Health check: http://localhost:${PORT}/health`);
      console.log(`🔧 Test CORS: http://localhost:${PORT}/api/cors-test`);
      console.log(`📚 Documentation: http://localhost:${PORT}/api/docs`);
      console.log('\n📍 URLs autorisées CORS:');
      const origins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
      origins.forEach(origin => console.log(`   ✅ ${origin}`));
      console.log('=================================\n');
    });
  } catch (error) {
    console.error('❌ CRITIQUE: Impossible de démarrer le serveur:', error);
    console.error('💡 Vérifiez:');
    console.error('   - La base de données PostgreSQL est-elle démarrée ?');
    console.error('   - Les variables d\'environnement sont-elles correctes ?');
    console.error('   - Le port 5000 est-il disponible ?');
    process.exit(1);
  }
};

// Gestion gracieuse de l'arrêt
process.on('SIGTERM', async () => {
  console.log('\n🛑 Réception SIGTERM, arrêt gracieux du serveur...');
  await sequelize.close();
  console.log('✅ Connexions fermées, arrêt complet.');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Réception SIGINT (Ctrl+C), arrêt gracieux du serveur...');
  await sequelize.close();
  console.log('✅ Connexions fermées, arrêt complet.');
  process.exit(0);
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('💥 ERREUR NON CAPTURÉE:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 PROMESSE NON GÉRÉE:', reason);
  process.exit(1);
});

// Démarrer le serveur
startServer();