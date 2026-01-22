const express = require('express');
const router = express.Router();
const { User } = require('../models/User');
const { auth } = require('../middleware/auth');

// GET /api/doctors - Récupérer tous les médecins
router.get('/', auth, async (req, res) => {
  try {
    console.log('📋 Récupération de tous les médecins...');
    
    const doctors = await User.findAll({
      where: { 
        role: 'doctor',
        isActive: true 
      },
      attributes: [
        'id', 'uniqueCode', 'firstName', 'lastName', 'email', 
        'specialty', 'phoneNumber', 'licenseNumber', 'biography',
        'languages', 'consultationPrice', 'availability', 
        'profilePicture', 'isActive', 'createdAt'
      ],
      order: [['firstName', 'ASC']]
    });

     console.log(`✅ ${doctors.length} médecins trouvés`);
    res.json({
      success: true,
      data: doctors,
      count: doctors.length
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des médecins:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des médecins',
      error: error.message
    });
  }
});

// GET /api/doctors/:id - Récupérer un médecin spécifique
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 Récupération du médecin ${id}...`);

    const doctor = await User.findOne({
      where: { 
        id, 
        role: 'doctor',
        isActive: true 
      },
      attributes: [
        'id', 'uniqueCode', 'firstName', 'lastName', 'email', 
        'specialty', 'phoneNumber', 'licenseNumber', 'biography',
        'languages', 'consultationPrice', 'availability', 
        'profilePicture', 'isActive', 'createdAt'
      ]
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Médecin non trouvé'
      });
    }

    console.log(`✅ Médecin trouvé: ${doctor.firstName} ${doctor.lastName}`);
    
    res.json({
      success: true,
      data: doctor
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération du médecin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération du médecin',
      error: error.message
    });
  }
});

// GET /api/doctors/:id/availability - Récupérer la disponibilité d'un médecin
router.get('/:id/availability', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    
    console.log(`📋 Récupération de la disponibilité du médecin ${id} pour ${date}`);

    const doctor = await User.findOne({
      where: { 
        id, 
        role: 'doctor',
        isActive: true 
      },
      attributes: ['id', 'availability']
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Médecin non trouvé'
      });
    }

    // Simuler des créneaux disponibles (à remplacer par votre logique réelle)
    const availableSlots = [
      { date, startTime: '09:00', endTime: '09:30', isAvailable: true },
      { date, startTime: '09:30', endTime: '10:00', isAvailable: true },
      { date, startTime: '10:00', endTime: '10:30', isAvailable: true },
      { date, startTime: '14:00', endTime: '14:30', isAvailable: true },
      { date, startTime: '14:30', endTime: '15:00', isAvailable: true },
      { date, startTime: '15:00', endTime: '15:30', isAvailable: true },
      { date, startTime: '16:00', endTime: '16:30', isAvailable: true },
    ];

    res.json({
      success: true,
      data: availableSlots
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération de la disponibilité:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération de la disponibilité',
      error: error.message
    });
  }
});

module.exports = router;
