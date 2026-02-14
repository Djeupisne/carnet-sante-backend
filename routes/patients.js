const express = require('express');
const router = express.Router();
const { User, Appointment } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { Op } = require('sequelize');

// GET /api/patients - Récupérer tous les patients (protégé - admin/médecins uniquement)
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Récupération de tous les patients...');
    
    // Vérifier les permissions (admin ou médecin)
    if (req.user.role !== 'admin' && req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }
    
    const patients = await User.findAll({
      where: { 
        role: 'patient',
        isActive: true 
      },
      attributes: [
        'id', 'uniqueCode', 'firstName', 'lastName', 'email', 
        'phoneNumber', 'dateOfBirth', 'gender', 'bloodType',
        'address', 'emergencyContact', 'isActive', 'createdAt'
      ],
      order: [['lastName', 'ASC'], ['firstName', 'ASC']]
    });

    // Pour chaque patient, ajouter des statistiques de base
    const patientsWithStats = await Promise.all(patients.map(async (patient) => {
      const appointmentsCount = await Appointment.count({
        where: { patientId: patient.id }
      });

      const lastAppointment = await Appointment.findOne({
        where: { patientId: patient.id },
        order: [['appointmentDate', 'DESC']],
        attributes: ['id', 'appointmentDate', 'status', 'doctorId']
      });

      let lastDoctor = null;
      if (lastAppointment) {
        lastDoctor = await User.findOne({
          where: { id: lastAppointment.doctorId },
          attributes: ['id', 'firstName', 'lastName', 'specialty']
        });
      }

      return {
        ...patient.toJSON(),
        stats: {
          totalAppointments: appointmentsCount,
          lastAppointment: lastAppointment ? {
            date: lastAppointment.appointmentDate,
            status: lastAppointment.status,
            doctor: lastDoctor
          } : null
        }
      };
    }));

    console.log(`✅ ${patients.length} patients trouvés`);
    res.json({
      success: true,
      data: patientsWithStats,
      count: patients.length
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

// GET /api/patients/:id - Récupérer un patient spécifique
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 Récupération du patient ${id}...`);

    // Vérifier les permissions (admin, médecin, ou le patient lui-même)
    if (req.user.role !== 'admin' && req.user.role !== 'doctor' && req.user.id !== id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    const patient = await User.findOne({
      where: { 
        id, 
        role: 'patient'
      },
      attributes: [
        'id', 'uniqueCode', 'firstName', 'lastName', 'email', 
        'phoneNumber', 'dateOfBirth', 'gender', 'bloodType',
        'address', 'emergencyContact', 'isActive', 'createdAt', 'updatedAt'
      ]
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient non trouvé'
      });
    }

    // Récupérer l'historique complet des rendez-vous
    const appointments = await Appointment.findAll({
      where: { patientId: id },
      order: [['appointmentDate', 'DESC']],
      include: [{
        model: User,
        as: 'doctor',
        attributes: ['id', 'firstName', 'lastName', 'specialty']
      }]
    });

    // Compter les médecins consultés
    const doctorsCount = await Appointment.count({
      where: { patientId: id },
      distinct: true,
      col: 'doctorId'
    });

    const patientData = {
      ...patient.toJSON(),
      appointments,
      stats: {
        totalAppointments: appointments.length,
        doctorsConsulted: doctorsCount,
        upcomingAppointments: appointments.filter(apt => 
          new Date(apt.appointmentDate) > new Date() && 
          ['pending', 'confirmed'].includes(apt.status)
        ).length
      }
    };

    console.log(`✅ Patient trouvé: ${patient.firstName} ${patient.lastName}`);
    
    res.json({
      success: true,
      data: patientData
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

// GET /api/patients/:id/doctors - Récupérer tous les médecins consultés par un patient
router.get('/:id/doctors', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 Récupération des médecins du patient ${id}...`);

    // Vérifier les permissions
    if (req.user.role !== 'admin' && req.user.role !== 'doctor' && req.user.id !== id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    // Vérifier que le patient existe
    const patient = await User.findOne({
      where: { id, role: 'patient' }
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient non trouvé'
      });
    }

    // Récupérer tous les IDs uniques des médecins consultés
    const appointments = await Appointment.findAll({
      where: { patientId: id },
      attributes: ['doctorId'],
      group: ['doctorId']
    });

    const doctorIds = appointments.map(apt => apt.doctorId);

    if (doctorIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        patient: {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName
        }
      });
    }

    // Récupérer les détails des médecins
    const doctors = await User.findAll({
      where: { 
        id: { [Op.in]: doctorIds },
        role: 'doctor'
      },
      attributes: [
        'id', 'firstName', 'lastName', 'specialty', 'email',
        'phoneNumber', 'consultationPrice', 'profilePicture'
      ]
    });

    // Pour chaque médecin, ajouter les rendez-vous avec ce patient
    const doctorsWithAppointments = await Promise.all(doctors.map(async (doctor) => {
      const doctorAppointments = await Appointment.findAll({
        where: { 
          doctorId: doctor.id,
          patientId: id 
        },
        order: [['appointmentDate', 'DESC']],
        attributes: ['id', 'appointmentDate', 'status', 'type', 'reason']
      });

      return {
        ...doctor.toJSON(),
        appointments: doctorAppointments,
        totalAppointments: doctorAppointments.length,
        lastAppointment: doctorAppointments[0] || null
      };
    }));

    res.json({
      success: true,
      data: doctorsWithAppointments,
      count: doctorsWithAppointments.length,
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName
      }
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

module.exports = router;
