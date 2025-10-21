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

// ✅ CORRIGÉ DÉFINITIF : Configuration trust proxy pour Render
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']); // ✅ Configuration complète

// ✅ MIDDLEWARE CORS CRITIQUE - PLACÉ EN PREMIER
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://carnet-sante-frontend.onrender.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.47.233:3000',
    'http://192.168.224.1:3000',
    'http://192.168.200.1:3000'
  ];
  
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Middleware de sécurité
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

// Compression Gzip
app.use(compression());

// Configuration CORS
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://carnet-sante-frontend.onrender.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://192.168.47.233:3000',
      'http://192.168.224.1:3000',
      'http://192.168.200.1:3000'
    ];
    
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('🚫 Origin bloqué par CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  maxAge: 86400
}));

// ✅ CORRIGÉ DÉFINITIF : Rate limiting avec configuration proxy complète
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 100,
  message: {
    success: false,
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ Configuration spécifique pour éviter l'erreur
  validate: { 
    trustProxy: false // Désactive la validation X-Forwarded-For
  }
});
app.use(limiter);

// Logging HTTP avec Morgan
app.use(morgan('combined', { 
  stream: logger.stream,
  skip: (req, res) => req.url === '/health'
}));

// Body parser middleware
app.use(express.json({ 
  limit: '50mb'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb'
}));

// Servir les fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, 'Uploads'), {
  setHeaders: (res, path) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Cache-Control', 'public, max-age=31536000');
  }
}));

// Servir les docs API
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

// Middleware de santé
app.use('/health', (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

// ✅ ROUTES API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/medical-files', require('./routes/medicalFile'));
app.use('/api/appointments', require('./routes/appointment'));
app.use('/api/payments', require('./routes/payment'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/search', require('./routes/search'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/calendars', require('./routes/calendar'));
app.use('/api/users', require('./routes/users'));

// ✅ ROUTE DE SANTÉ AMÉLIORÉE
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await testConnection();
    
    const origin = req.headers.origin;
    const allowedOrigins = [
      'https://carnet-sante-frontend.onrender.com',
      'http://localhost:3000'
    ];
    
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
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
      proxy: {
        trustProxy: '✅ Configuré (array)',
        xForwardedFor: req.headers['x-forwarded-for'] || 'Non défini'
      },
      cors: {
        allowedOrigins: allowedOrigins,
        currentOrigin: origin,
        status: '✅ Configuré'
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

// ✅ ROUTE RACINE
app.get('/', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://carnet-sante-frontend.onrender.com',
    'http://localhost:3000'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  res.json({
    success: true,
    message: '🏥 API Carnet de Santé Virtuel',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/health',
    cors_test: '/api/cors-test',
    proxy: {
      status: '✅ Trust proxy configuré',
      config: 'array'
    },
    endpoints: {
      auth: '/api/auth',
      profile: '/api/profile',
      medicalFiles: '/api/medical-files',
      appointments: '/api/appointments',
      payments: '/api/payments',
      admin: '/api/admin',
      search: '/api/search',
      notifications: '/api/notifications',
      users: '/api/users'
    }
  });
});

// ✅ ROUTE DE TEST CORS
app.get('/api/cors-test', (req, res) => {
  const origin = req.headers.origin;
  console.log('🧪 Test CORS - Origin:', origin);
  
  const allowedOrigins = [
    'https://carnet-sante-frontend.onrender.com',
    'http://localhost:3000'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  res.json({
    success: true,
    message: '✅ Test CORS réussi !',
    origin: origin,
    timestamp: new Date().toISOString(),
    proxy: {
      trustProxy: '✅ Configuré',
      xForwardedFor: req.headers['x-forwarded-for'] || 'Non défini'
    },
    cors: {
      allowedOrigins: allowedOrigins,
      currentOrigin: origin,
      status: '✅ Autorisé'
    }
  });
});

// Gestion des routes non trouvées
app.use(notFound);

// Gestion des erreurs
app.use(errorHandler);

const PORT = process.env.PORT || 10000;

const startServer = async () => {
  try {
    console.log('🚀 Démarrage du serveur Carnet de Santé...');
    
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('❌ Impossible de se connecter à la base de données');
    }
    
    console.log('🔄 Synchronisation des modèles...');
    await sequelize.sync({ 
      alter: false,
      force: false,
      logging: false
    });
    console.log('✅ Modèles synchronisés');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n🎉 SERVEUR DÉMARRÉ AVEC SUCCÈS!');
      console.log('=================================');
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 URL: http://localhost:${PORT}`);
      console.log(`🌐 URL réseau: http://0.0.0.0:${PORT}`);
      console.log(`❤️  Health check: http://localhost:${PORT}/health`);
      console.log(`🔧 Test CORS: http://localhost:${PORT}/api/cors-test`);
      console.log(`🛡️  Trust proxy: ✅ Configuré (array)`);
      console.log('\n📍 URLs autorisées CORS:');
      console.log('   ✅ https://carnet-sante-frontend.onrender.com');
      console.log('   ✅ http://localhost:3000');
      console.log('=================================\n');
    });
  } catch (error) {
    console.error('❌ CRITIQUE: Impossible de démarrer le serveur:', error);
    process.exit(1);
  }
};

// Gestion gracieuse de l'arrêt
process.on('SIGTERM', async () => {
  console.log('\n🛑 Arrêt gracieux du serveur...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt gracieux (Ctrl+C)...');
  await sequelize.close();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Erreur non capturée:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promesse non gérée:', reason);
});

// Démarrer le serveur
startServer();