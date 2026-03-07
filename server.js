require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const { sequelize, testConnection } = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');

const app = express();

// ✅ Configuration trust proxy pour Render
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// ✅ MIDDLEWARE CORS — PLACÉ EN PREMIER
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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 100,
  message: { success: false, message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }
});
app.use(limiter);

// Logging HTTP
app.use(morgan('combined', {
  stream: logger.stream,
  skip: (req, res) => req.url === '/health'
}));

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Debug middleware auth
app.use((req, res, next) => {
  if (req.path === '/api/auth/register' || req.path === '/api/auth/login') {
    console.log('\n🔍 === DEBUG: BODY REÇU PAR EXPRESS ===');
    console.log('📍 Path:', req.path);
    console.log('📋 Method:', req.method);
    console.log('📦 Headers Content-Type:', req.headers['content-type']);
    console.log('📦 Headers Origin:', req.headers.origin);
    console.log('📦 Body complet:', JSON.stringify(req.body, null, 2));
    console.log('🔑 Clés présentes dans body:', Object.keys(req.body));
    console.log('===========================================\n');
  }
  next();
});

// ============================================
// ✅ FICHIERS STATIQUES — CORRECTION CRITIQUE
// ============================================
// 'uploads' en minuscules (Linux est case-sensitive sur Render)
// On s'assure que le dossier existe au démarrage
const uploadsDir = path.join(__dirname, 'uploads', 'profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Dossier uploads/profiles créé');
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    // ✅ CORS ouvert pour que le frontend puisse charger les images
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    // Cache court pour éviter de servir d'anciennes images supprimées
    res.set('Cache-Control', 'public, max-age=3600');
  }
}));

// Docs API
app.use('/api/docs', express.static(path.join(__dirname, 'docs')));

// Logging des requêtes
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      origin: req.headers.origin,
      duration
    });
  });
  next();
});

// Middleware santé
app.use('/health', (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

// ============================================
// ✅ ROUTES API
// ============================================
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
app.use('/api/doctors', require('./routes/doctors'));

// ============================================
// ROUTES SYSTÈME
// ============================================

app.get('/health', async (req, res) => {
  try {
    const dbStatus = await testConnection();
    const origin = req.headers.origin;
    const allowedOrigins = ['https://carnet-sante-frontend.onrender.com', 'http://localhost:3000'];

    if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    res.json({
      success: true,
      message: '🚀 Serveur Carnet de Santé en ligne',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: { status: dbStatus ? '✅ Connecté' : '❌ Erreur', type: 'PostgreSQL' },
      server: {
        port: process.env.PORT,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      },
      uploads: {
        directory: uploadsDir,
        exists: fs.existsSync(uploadsDir) ? '✅' : '❌'
      }
    });
  } catch (error) {
    res.status(503).json({ success: false, message: '⚠️ Serveur en difficulté', error: error.message });
  }
});

app.get('/', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['https://carnet-sante-frontend.onrender.com', 'http://localhost:3000'];
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  res.json({
    success: true,
    message: '🏥 API Carnet de Santé Virtuel',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/health',
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
      calendars: '/api/calendars',
      doctors: '/api/doctors'
    }
  });
});

app.get('/api/cors-test', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['https://carnet-sante-frontend.onrender.com', 'http://localhost:3000'];
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  res.json({
    success: true,
    message: '✅ Test CORS réussi !',
    origin,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ROUTES DEBUG
// ============================================

app.get('/api/test-availability/:doctorId', async (req, res) => {
  try {
    const { Calendar } = require('./models');
    if (!Calendar) return res.status(500).json({ success: false, message: 'Modèle Calendar non disponible' });

    const calendar = await Calendar.findOne({
      where: { doctorId: req.params.doctorId, date: req.query.date || new Date().toISOString().split('T')[0] }
    });

    res.json({
      success: true,
      message: calendar ? '✅ Disponibilités trouvées' : '⚠️ Aucune disponibilité',
      data: calendar || { doctorId: req.params.doctorId, date: req.query.date, slots: [] }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/debug/user-structure', async (req, res) => {
  try {
    const { User } = require('./models');
    const tableDescription = await User.describe();
    const sampleUser = await User.findOne({ attributes: { exclude: [] } });
    res.json({
      success: true,
      modelAttributes: Object.keys(User.rawAttributes),
      tableColumns: Object.keys(tableDescription),
      sampleUserFields: sampleUser ? Object.keys(sampleUser.toJSON()) : [],
      count: await User.count()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/debug/test-users', async (req, res) => {
  try {
    const { User } = require('./models');
    const users = await User.findAll({ attributes: ['id', 'email', 'firstName', 'lastName', 'role'], limit: 5 });
    res.json({ success: true, count: users.length, sample: users.length > 0 ? users[0] : null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/debug/email-status', async (req, res) => {
  try {
    const emailService = require('./services/emailService');
    res.json({
      success: true,
      data: {
        isEnabled: emailService.isEnabled,
        hasTransporter: !!emailService.transporter,
        smtpConfig: {
          host: process.env.SMTP_HOST ? '✅ présent' : '❌ manquant',
          port: process.env.SMTP_PORT ? '✅ présent' : '❌ manquant',
          user: process.env.SMTP_USER ? '✅ présent' : '❌ manquant',
          pass: process.env.SMTP_PASS ? '✅ présent' : '❌ manquant',
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/debug/email-test/:email', async (req, res) => {
  try {
    const emailService = require('./services/emailService');
    const result = await emailService.sendEmail({
      to: req.params.email,
      subject: '🔧 Test Carnet Santé - Debug Email',
      html: `<p>Test réussi — ${new Date().toISOString()}</p>`,
      text: `Test Carnet Santé — ${new Date().toISOString()}`
    });
    res.json({ success: true, sendResult: result, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/debug/test-welcome-email', async (req, res) => {
  try {
    const { email, firstName, lastName, role } = req.body;
    if (!email || !firstName || !lastName || !role) {
      return res.status(400).json({ success: false, message: 'Email, prénom, nom et rôle requis' });
    }
    const notificationService = require('./services/notificationService');
    const mockUser = {
      id: 'test-' + Date.now(), email, firstName, lastName, role,
      uniqueCode: role === 'doctor' ? 'DOC-TEST-123' : 'PAT-TEST-123'
    };
    const result = await notificationService.sendWelcomeEmail(mockUser);
    res.json({ success: true, message: 'Email de bienvenue test envoyé', result, user: mockUser });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GESTION DES ERREURS
// ============================================
app.use(notFound);
app.use(errorHandler);

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================
const PORT = process.env.PORT || 10000;

const startServer = async () => {
  try {
    console.log('🚀 Démarrage du serveur Carnet de Santé...');

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('\n🎉 SERVEUR DÉMARRÉ AVEC SUCCÈS!');
      console.log('=================================');
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 URL: http://localhost:${PORT}`);
      console.log(`❤️  Health check: http://localhost:${PORT}/health`);
      console.log(`📁 Uploads: ${uploadsDir}`);
      console.log('=================================\n');
    });

    console.log('🔄 Connexion à la base de données...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.warn('⚠️ Impossible de se connecter à la base de données, mais le serveur continue');
    } else {
      console.log('✅ Base de données connectée');
      console.log('🔄 Synchronisation des modèles...');

      await sequelize.sync({ alter: false, force: false, logging: false });
      console.log('✅ Modèles principaux synchronisés');

      try {
        const { Notification, NotificationLog } = require('./models');
        if (Notification) await Notification.sync({ alter: false, force: false });
        if (NotificationLog) await NotificationLog.sync({ alter: false, force: false });
        console.log('✅ Modèles Notification synchronisés');
      } catch (notifError) {
        console.error('❌ Erreur synchronisation modèles notification:', notifError.message);
      }

      try {
        const { Calendar, User } = require('./models');
        if (Calendar) {
          await Calendar.sync({ alter: false, force: false });
          console.log('✅ Modèle Calendar synchronisé');

          const doctors = await User.findAll({ where: { role: 'doctor', isActive: true } });
          if (doctors.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            const defaultSlots = [
              '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
              '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
              '16:00', '16:30', '17:00'
            ];
            let created = 0;
            for (const doctor of doctors) {
              const existing = await Calendar.findOne({ where: { doctorId: doctor.id, date: today } });
              if (!existing) {
                await Calendar.create({ doctorId: doctor.id, date: today, slots: defaultSlots, confirmed: false, versions: [] });
                created++;
              }
            }
            console.log(`✅ ${created} disponibilités créées pour aujourd'hui (${doctors.length} médecins)`);
          }
        }
      } catch (calendarError) {
        console.error('❌ Erreur Calendar:', calendarError.message);
      }

      console.log('✅ Tous les modèles sont prêts');

      try {
        const reminderScheduler = require('./jobs/reminderScheduler');
        reminderScheduler.start();
        console.log('✅ Planificateur de rappels démarré');
      } catch (schedulerError) {
        console.error('❌ Erreur planificateur:', schedulerError.message);
      }
    }
  } catch (error) {
    console.error('❌ ERREUR lors du démarrage:', error);
  }
};

process.on('SIGTERM', async () => {
  console.log('\n🛑 Arrêt gracieux du serveur...');
  try { const r = require('./jobs/reminderScheduler'); r.stop(); } catch (e) {}
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt gracieux (Ctrl+C)...');
  try { const r = require('./jobs/reminderScheduler'); r.stop(); } catch (e) {}
  await sequelize.close();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Erreur non capturée:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Promesse non gérée:', reason);
});

startServer();

module.exports = app;
