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
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
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
app.use('/api/notifications', require('./routes/notifications')); // ✅ Route notifications
app.use('/api/calendars', require('./routes/calendar'));
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
      calendars: '/api/calendars',
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

// ✅ ROUTE DE TEST POUR VÉRIFIER LES DISPONIBILITÉS - CORRIGÉE
app.get('/api/test-availability/:doctorId', async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;
    
    // ✅ CORRIGÉ: Importer depuis ./models, PAS depuis ./models/calendar
    const { Calendar } = require('./models');
    
    if (!Calendar) {
      return res.status(500).json({ 
        success: false, 
        message: 'Modèle Calendar non disponible' 
      });
    }
    
    let calendar = await Calendar.findOne({
      where: { 
        doctorId, 
        date: date || new Date().toISOString().split('T')[0] 
      }
    });
    
    res.json({
      success: true,
      message: calendar ? '✅ Disponibilités trouvées' : '⚠️ Aucune disponibilité',
      data: calendar || { doctorId, date, slots: [] }
    });
  } catch (error) {
    console.error('❌ Erreur test availability:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ========== ROUTES DE DEBUG EXISTANTES ==========
// Route pour voir la structure de la table User
app.get('/api/debug/user-structure', async (req, res) => {
  try {
    const { User } = require('./models');
    
    console.log('🔍 Debug: Récupération de la structure de User...');
    
    // Méthode 1: Décrire la table
    const tableDescription = await User.describe();
    
    // Méthode 2: Récupérer un utilisateur exemple
    const sampleUser = await User.findOne({
      attributes: { exclude: [] } // Tous les champs
    });
    
    const sampleUserFields = sampleUser ? Object.keys(sampleUser.toJSON()) : [];
    
    // Méthode 3: Attributs du modèle
    const modelAttributes = Object.keys(User.rawAttributes);
    
    res.json({
      success: true,
      modelAttributes,
      tableColumns: Object.keys(tableDescription),
      sampleUserFields,
      count: await User.count()
    });
  } catch (error) {
    console.error('❌ Erreur debug user-structure:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Route pour tester un findAll simple
app.get('/api/debug/test-users', async (req, res) => {
  try {
    const { User } = require('./models');
    
    console.log('🔍 Test findAll simple sur User...');
    
    // Test 1: Sans aucun paramètre
    const users1 = await User.findAll({
      limit: 5
    });
    
    // Test 2: Avec un champ spécifique
    const users2 = await User.findAll({
      attributes: ['id', 'email', 'firstName', 'lastName', 'role'],
      limit: 5
    });
    
    res.json({
      success: true,
      test1: {
        count: users1.length,
        sample: users1.length > 0 ? Object.keys(users1[0].toJSON()) : []
      },
      test2: {
        count: users2.length,
        sample: users2.length > 0 ? users2[0] : null
      }
    });
  } catch (error) {
    console.error('❌ Erreur test-users:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Route pour tester avec les filtres admin
app.get('/api/debug/admin-users-test', async (req, res) => {
  try {
    const { User, AuditLog } = require('./models');
    const { Op } = require('sequelize');
    
    console.log('🔍 Test avec les mêmes paramètres que admin...');
    
    // Simuler les paramètres de getUsers
    const role = req.query.role;
    const isActive = req.query.isActive;
    const search = req.query.search;
    
    const whereClause = {};
    if (role) whereClause.role = role;
    if (isActive !== undefined) whereClause.isActive = isActive === 'true';
    
    if (search) {
      whereClause[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    console.log('Where clause:', whereClause);
    
    // Test avec exclude
    try {
      const usersWithExclude = await User.findAll({
        where: whereClause,
        attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] },
        limit: 5
      });
      
      console.log(`✅ Avec exclude: ${usersWithExclude.length} utilisateurs`);
      
      res.json({
        success: true,
        withExclude: {
          count: usersWithExclude.length,
          sample: usersWithExclude.length > 0 ? usersWithExclude[0] : null
        },
        whereClause
      });
    } catch (excludeError) {
      console.error('❌ Erreur avec exclude:', excludeError);
      
      // Fallback sans exclude
      const usersWithoutExclude = await User.findAll({
        where: whereClause,
        limit: 5
      });
      
      res.json({
        success: true,
        withExclude: {
          error: excludeError.message,
          name: excludeError.name
        },
        withoutExclude: {
          count: usersWithoutExclude.length,
          sample: usersWithoutExclude.length > 0 ? usersWithoutExclude[0] : null
        },
        whereClause
      });
    }
  } catch (error) {
    console.error('❌ Erreur admin-users-test:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
});

// ========== NOUVELLES ROUTES DE DEBUG EMAIL ==========
// Route pour vérifier le statut du service email
app.get('/api/debug/email-status', async (req, res) => {
  try {
    console.log('\n📧 Vérification du statut du service email...');
    
    const emailService = require('./services/emailService');
    
    // Récupérer l'état du service
    const status = {
      isEnabled: emailService.isEnabled,
      hasTransporter: !!emailService.transporter,
      smtpConfig: {
        host: process.env.SMTP_HOST ? '✅ présent' : '❌ manquant',
        port: process.env.SMTP_PORT ? '✅ présent' : '❌ manquant',
        user: process.env.SMTP_USER ? '✅ présent' : '❌ manquant',
        pass: process.env.SMTP_PASS ? '✅ présent (cache)' : '❌ manquant',
        secure: process.env.SMTP_SECURE || 'false'
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('📧 Statut service:', status);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('❌ Erreur vérification email-status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Route pour tester l'envoi d'email
app.get('/api/debug/email-test/:email', async (req, res) => {
  try {
    console.log('\n📧 ===== TEST EMAIL MANUEL =====');
    console.log('📧 Destinataire:', req.params.email);
    console.log('📧 Timestamp:', new Date().toISOString());
    
    const emailService = require('./services/emailService');
    
    // Vérifier l'état du service
    const serviceStatus = {
      isEnabled: emailService.isEnabled,
      hasTransporter: !!emailService.transporter,
      smtpConfig: {
        host: process.env.SMTP_HOST ? '✓' : '✗',
        port: process.env.SMTP_PORT ? '✓' : '✗',
        user: process.env.SMTP_USER ? '✓' : '✗',
        pass: process.env.SMTP_PASS ? '✓' : '✗',
      }
    };
    
    console.log('📧 Statut service avant envoi:', serviceStatus);
    
    // Tenter d'envoyer un email
    const result = await emailService.sendEmail({
      to: req.params.email,
      subject: '🔧 Test Carnet Santé - Debug Email',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .success { color: #10b981; font-weight: bold; }
            .info { background: #e0f2fe; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Carnet Santé</h1>
              <p>Test de configuration email</p>
            </div>
            <div class="content">
              <h2 class="success">✅ Test réussi !</h2>
              <p>Si vous recevez cet email, votre service SMTP fonctionne correctement.</p>
              
              <div class="info">
                <h3>Informations de test :</h3>
                <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                <p><strong>Serveur SMTP:</strong> ${process.env.SMTP_HOST}</p>
                <p><strong>Utilisateur:</strong> ${process.env.SMTP_USER}</p>
                <p><strong>Port:</strong> ${process.env.SMTP_PORT}</p>
                <p><strong>Secure:</strong> ${process.env.SMTP_SECURE}</p>
              </div>
              
              <p>Votre système de notifications est maintenant opérationnel !</p>
              <p>Les emails suivants seront automatiquement envoyés :</p>
              <ul>
                <li>✅ Email de bienvenue à l'inscription</li>
                <li>✅ Confirmation de rendez-vous</li>
                <li>✅ Rappels 24h et 1h avant le rendez-vous</li>
                <li>✅ Notifications d'annulation</li>
              </ul>
            </div>
            <div class="footer">
              <p>Cet email a été envoyé automatiquement depuis Carnet Santé.</p>
              <p>© ${new Date().getFullYear()} Carnet Santé. Tous droits réservés.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Test Carnet Santé - Debug Email\n\nSi vous recevez cet email, votre service SMTP fonctionne correctement.\n\nTimestamp: ${new Date().toISOString()}\nServeur: ${process.env.SMTP_HOST}`
    });
    
    console.log('📧 Résultat envoi:', result);
    
    res.json({
      success: true,
      serviceStatus,
      sendResult: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur test email:');
    console.error('  - Message:', error.message);
    console.error('  - Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Route pour tester l'envoi d'un email de bienvenue simulé
app.post('/api/debug/test-welcome-email', async (req, res) => {
  try {
    const { email, firstName, lastName, role } = req.body;
    
    if (!email || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, prénom, nom et rôle requis'
      });
    }
    
    console.log('\n📧 ===== TEST EMAIL DE BIENVENUE =====');
    console.log('📧 Destinataire:', email);
    console.log('📧 Utilisateur:', { firstName, lastName, role });
    
    const notificationService = require('./services/notificationService');
    
    // Créer un utilisateur factice pour le test
    const mockUser = {
      id: 'test-' + Date.now(),
      email,
      firstName,
      lastName,
      role,
      uniqueCode: role === 'doctor' ? 'DOC-TEST-123' : 'PAT-TEST-123'
    };
    
    const result = await notificationService.sendWelcomeEmail(mockUser);
    
    res.json({
      success: true,
      message: 'Email de bienvenue test envoyé',
      result,
      user: mockUser
    });
    
  } catch (error) {
    console.error('❌ Erreur test welcome email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// ========== FIN ROUTES DE DEBUG EMAIL ==========

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
      console.log(`📧 Test Email: http://localhost:${PORT}/api/debug/email-status`);
      console.log(`📧 Test Envoi: http://localhost:${PORT}/api/debug/email-test/votre@email.com`);
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
      
      // ✅ IMPORTANT: Synchronisation SANS alter:true pour éviter les erreurs
      console.log('🔄 Synchronisation des modèles...');
      
      // ✅ CORRIGÉ: alter: false pour éviter les erreurs de migration PostgreSQL
      await sequelize.sync({ 
        alter: false,  // ← CRITIQUE: Ne pas forcer les migrations
        force: false,
        logging: false
      });
      
      console.log('✅ Modèles principaux synchronisés');
      
      // ✅ Synchronisation des nouveaux modèles de notification
      try {
        const { Notification, NotificationLog } = require('./models');
        
        if (Notification) {
          await Notification.sync({ alter: false, force: false });
          console.log('✅ Modèle Notification synchronisé');
        }
        
        if (NotificationLog) {
          await NotificationLog.sync({ alter: false, force: false });
          console.log('✅ Modèle NotificationLog synchronisé');
        }
      } catch (notifError) {
        console.error('❌ Erreur synchronisation modèles notification:', notifError.message);
      }
      
      // ✅ CORRIGÉ: Calendar est DÉJÀ dans db via models/index.js
      try {
        // ✅ Importer depuis ./models, PAS depuis ./models/calendar
        const { Calendar, User } = require('./models');
        
        if (!Calendar) {
          console.warn('⚠️ Modèle Calendar non trouvé dans db');
        } else {
          console.log('✅ Modèle Calendar trouvé dans db');
          
          // ✅ Synchroniser avec alter: false
          await Calendar.sync({ alter: false, force: false });
          console.log('✅ Modèle Calendar synchronisé');
          
          // ✅ Créer automatiquement des disponibilités pour les médecins
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
            
            let created = 0;
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
                created++;
                console.log(`   ✅ Disponibilités créées pour Dr. ${doctor.firstName} ${doctor.lastName}`);
              }
            }
            console.log(`✅ ${created} disponibilités créées pour aujourd'hui`);
          }
        }
      } catch (calendarError) {
        console.error('❌ Erreur lors de la synchronisation du modèle Calendar:', calendarError.message);
      }
      
      console.log('✅ Tous les modèles sont prêts');
      
      // ✅ Démarrer le planificateur de rappels
      try {
        const reminderScheduler = require('./jobs/reminderScheduler');
        reminderScheduler.start();
        console.log('✅ Planificateur de rappels démarré');
      } catch (schedulerError) {
        console.error('❌ Erreur démarrage planificateur:', schedulerError.message);
      }
    }
  } catch (error) {
    console.error('❌ ERREUR lors du démarrage:', error);
  }
};

// Gestion gracieuse de l'arrêt
process.on('SIGTERM', async () => {
  console.log('\n🛑 Arrêt gracieux du serveur...');
  
  // Arrêter le planificateur
  try {
    const reminderScheduler = require('./jobs/reminderScheduler');
    reminderScheduler.stop();
  } catch (e) {}
  
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt gracieux (Ctrl+C)...');
  
  // Arrêter le planificateur
  try {
    const reminderScheduler = require('./jobs/reminderScheduler');
    reminderScheduler.stop();
  } catch (e) {}
  
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
