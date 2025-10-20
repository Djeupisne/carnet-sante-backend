const { User, MedicalFile, Appointment } = require('../models');
const { Op } = require('sequelize');
const { validationService } = require('../services/validationService');

exports.globalSearch = async (req, res) => {
  try {
    const { q: query, type, page = 1, limit = 20 } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Requête de recherche trop courte (minimum 2 caractères)'
      });
    }

    const offset = (page - 1) * limit;
    let results = {};

    // Recherche dans les utilisateurs
    if (!type || type === 'users') {
      const { count: usersCount, rows: users } = await User.findAndCountAll({
        where: {
          [Op.or]: [
            { firstName: { [Op.iLike]: `%${query}%` } },
            { lastName: { [Op.iLike]: `%${query}%` } },
            { email: { [Op.iLike]: `%${query}%` } },
            { uniqueCode: { [Op.iLike]: `%${query}%` } }
          ],
          isActive: true
        },
        attributes: { exclude: ['password', 'resetToken', 'resetTokenExpiry'] },
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      results.users = {
        data: users,
        total: usersCount
      };
    }

    // Recherche dans les dossiers médicaux (admin/doctors seulement)
    if ((!type || type === 'medical_files') && 
        (req.user.role === 'admin' || req.user.role === 'doctor')) {
      
      const { count: filesCount, rows: medicalFiles } = await MedicalFile.findAndCountAll({
        where: {
          [Op.or]: [
            { title: { [Op.iLike]: `%${query}%` } },
            { diagnosis: { [Op.iLike]: `%${query}%` } },
            { description: { [Op.iLike]: `%${query}%` } }
          ]
        },
        include: [
          {
            model: User,
            as: 'patient',
            attributes: ['id', 'firstName', 'lastName', 'uniqueCode']
          },
          {
            model: User,
            as: 'doctor',
            attributes: ['id', 'firstName', 'lastName']
          }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      results.medicalFiles = {
        data: medicalFiles,
        total: filesCount
      };
    }

    // Recherche dans les rendez-vous
    if (!type || type === 'appointments') {
      const whereClause = {
        [Op.or]: [
          { reason: { [Op.iLike]: `%${query}%` } },
          { notes: { [Op.iLike]: `%${query}%` } }
        ]
      };

      // Les patients ne voient que leurs rendez-vous
      if (req.user.role === 'patient') {
        whereClause.patientId = req.user.id;
      }
      // Les médecins ne voient que leurs rendez-vous
      if (req.user.role === 'doctor') {
        whereClause.doctorId = req.user.id;
      }

      const { count: appointmentsCount, rows: appointments } = await Appointment.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'patient',
            attributes: ['id', 'firstName', 'lastName', 'uniqueCode']
          },
          {
            model: User,
            as: 'doctor',
            attributes: ['id', 'firstName', 'lastName']
          }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      results.appointments = {
        data: appointments,
        total: appointmentsCount
      };
    }

    res.json({
      success: true,
      data: {
        query,
        results,
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la recherche globale:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

exports.searchDoctors = async (req, res) => {
  try {
    const { specialty, city, availability, page = 1, limit = 20 } = req.query;

    const whereClause = {
      role: 'doctor',
      isActive: true,
      isVerified: true
    };

    if (specialty) {
      whereClause.specialty = { [Op.iLike]: `%${specialty}%` };
    }

    if (city) {
      whereClause['$address.city$'] = { [Op.iLike]: `%${city}%` };
    }

    const offset = (page - 1) * limit;

    const { count, rows: doctors } = await User.findAndCountAll({
      where: whereClause,
      attributes: { 
        exclude: ['password', 'resetToken', 'resetTokenExpiry'],
        include: [
          [
            sequelize.literal(`(
              SELECT AVG(rating) 
              FROM "Reviews" 
              WHERE "Reviews"."doctorId" = "User"."id"
            )`),
            'averageRating'
          ],
          [
            sequelize.literal(`(
              SELECT COUNT(*) 
              FROM "Reviews" 
              WHERE "Reviews"."doctorId" = "User"."id"
            )`),
            'reviewCount'
          ]
        ]
      },
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Filtrer par disponibilité si demandé
    let availableDoctors = doctors;
    if (availability) {
      const availableDate = new Date(availability);
      
      // Vérifier les rendez-vous existants
      const busyDoctors = await Appointment.findAll({
        where: {
          doctorId: doctors.map(d => d.id),
          appointmentDate: {
            [Op.between]: [
              new Date(availableDate.setHours(0, 0, 0, 0)),
              new Date(availableDate.setHours(23, 59, 59, 999))
            ]
          },
          status: {
            [Op.in]: ['pending', 'confirmed']
          }
        },
        attributes: ['doctorId']
      });

      const busyDoctorIds = busyDoctors.map(a => a.doctorId);
      availableDoctors = doctors.filter(doctor => !busyDoctorIds.includes(doctor.id));
    }

    res.json({
      success: true,
      data: {
        doctors: availableDoctors,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(count / limit),
          totalRecords: count
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la recherche de médecins:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};