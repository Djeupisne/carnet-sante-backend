const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { auth } = require('../middleware/auth');

// GET /api/doctors - Récupérer tous les médecins
router.get('/', auth, async (req, res) => {
  try {
    console.log('📋 Récupération de tous les médecins...');
    
    if (!User || typeof User.findAll !== 'function') {
      console.error('❌ ERREUR CRITIQUE: Modèle User non chargé');
      throw new Error('Modèle User non disponible');
    }
    
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
    console.error('❌ Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
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
    console.error('❌ Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// ⚠️ SUPPRIMEZ COMPLÈTEMENT la route /:id/availability
// Elle est remplacée par /api/calendars/available-slots/:doctorId

module.exports = router;
