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
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

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
  validate: { 
    trustProxy: false
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

// 🔍 MIDDLEWARE DE DEBUG CRITIQUE
app.use((req, res, next) => {
  if (req.path === '/api/auth/register' || req.path === '/api/auth/login') {
    console.log('\n🔍 === DEBUG: BODY REÇU PAR EXPRESS ===');
    console.log('📍 Path:', req.path);
    console.log('📋 Method:', req.method);
    console.log('📦 Headers Content-Type:', req.headers['content-type']);
    console.log('📦 Headers Origin:', req.headers.origin);
    console.log('📦 Body complet:', JSON.stringify(req.body, null, 2));
    console.log('🔑 Clés présentes dans body:', Object.keys(req.body));
    console.log('🔍 Vérification des champs critiques:');
    console.log('   - email présent?', 'email' in req.body, '→', req.body.email);
    console.log('   - password présent?', 'password' in req.body, '→', req.body.password ? '***' : 'vide');
    console.log('   - firstName présent?', 'firstName' in req.body, '→', req.body.firstName);
    console.log('   - lastName présent?', 'lastName' in req.body, '→', req.body.lastName);
    console.log('   - specialty présent?', 'specialty' in req.body, '→', req.body.specialty);
    console.log('   - licenseNumber présent?', 'licenseNumber' in req.body, '→', req.body.licenseNumber);
    console.log('   - biography présent?', 'biography' in req.body, '→', req.body.biography);
    console.log('   - languages présent?', 'languages' in req.body, '→', req.body.languages);
    console.log('   - role présent?', 'role' in req.body, '→', req.body.role);
    console.log('===========================================\n');
  }
  next();
});

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
app.use('/api/calendars', require('./routes/calendar')); // ✅ IMPORTANT: Routes des disponibilités
app.use('/api/users', require('./routes/users'));
app.use('/api/doctors', require('./routes/doctors'));

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
      users: '/api/users',
      calendars: '/api/calendars', // ✅ Ajouté
      doctors: '/api/doctors'
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

// ✅ ROUTE DE TEST POUR VÉRIFIER LES DISPONIBILITÉS
app.get('/api/test-availability/:doctorId', async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;
    
    // Importer le modèle Calendar
    const { Calendar } = require('./models/calendar');
    
    let calendar = await Calendar.findOne({
      where: { doctorId, date: date || new Date().toISOString().split('T')[0] }
    });
    
    res.json({
      success: true,
      message: calendar ? '✅ Disponibilités trouvées' : '⚠️ Aucune disponibilité',
      data: calendar || { doctorId, date, slots: [] }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Gestion des routes non trouvées
app.use(notFound);

// Gestion des erreurs
app.use(errorHandler);

const PORT = process.env.PORT || 10000;

const startServer = async () => {
  try {
    console.log('🚀 Démarrage du serveur Carnet de Santé...');
    
    // ✅ CRITIQUE : Démarrer le serveur IMMÉDIATEMENT
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('\n🎉 SERVEUR DÉMARRÉ AVEC SUCCÈS!');
      console.log('=================================');
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 URL: http://localhost:${PORT}`);
      console.log(`🌐 URL réseau: http://0.0.0.0:${PORT}`);
      console.log(`❤️  Health check: http://localhost:${PORT}/health`);
      console.log(`🔧 Test CORS: http://localhost:${PORT}/api/cors-test`);
      console.log(`🛡️  Trust proxy: ✅ Configuré (array)`);
      console.log(`🔍 Debug middleware: ✅ Activé pour /api/auth/register`);
      console.log('\n📍 URLs autorisées CORS:');
      console.log('   ✅ https://carnet-sante-frontend.onrender.com');
      console.log('   ✅ http://localhost:3000');
      console.log('=================================\n');
    });
    
    // ✅ CONNEXION À LA BASE DE DONNÉES
    console.log('🔄 Connexion à la base de données...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.warn('⚠️ Impossible de se connecter à la base de données, mais le serveur continue');
    } else {
      console.log('✅ Base de données connectée');
      
      // ✅ IMPORTANT: Synchroniser les modèles DANS LE BON ORDRE
      console.log('🔄 Synchronisation des modèles...');
      
      // 1. D'abord les modèles principaux
      await sequelize.sync({ 
        alter: true, // Changé de false à true pour créer les tables manquantes
        force: false,
        logging: false
      });
      
      console.log('✅ Modèles principaux synchronisés');
      
      // 2. Vérifier et créer le modèle Calendar s'il n'existe pas
      try {
        const { Calendar } = require('./models/calendar');
        
        // Synchroniser spécifiquement le modèle Calendar
        await Calendar.sync({ alter: true });
        console.log('✅ Modèle Calendar synchronisé avec succès');
        
        // ✅ OPTIONNEL: Créer automatiquement des disponibilités pour les médecins existants
        const { User } = require('./models');
        const doctors = await User.findAll({
          where: { role: 'doctor', isActive: true }
        });
        
        if (doctors.length > 0) {
          console.log(`👨‍⚕️ ${doctors.length} médecins trouvés, vérification des disponibilités...`);
          
          const today = new Date().toISOString().split('T')[0];
          const defaultSlots = [
            '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
            '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
            '16:00', '16:30', '17:00'
          ];
          
          for (const doctor of doctors) {
            const existing = await Calendar.findOne({
              where: { doctorId: doctor.id, date: today }
            });
            
            if (!existing) {
              await Calendar.create({
                doctorId: doctor.id,
                date: today,
                slots: defaultSlots,
                confirmed: false,
                versions: []
              });
              console.log(`   ✅ Disponibilités créées pour Dr. ${doctor.firstName} ${doctor.lastName}`);
            }
          }
          console.log('✅ Disponibilités initiales créées');
        }
      } catch (calendarError) {
        console.error('❌ Erreur lors de la synchronisation du modèle Calendar:', calendarError.message);
      }
      
      console.log('✅ Tous les modèles sont prêts');
    }
  } catch (error) {
    console.error('❌ ERREUR lors du démarrage:', error);
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

module.exports = app;
