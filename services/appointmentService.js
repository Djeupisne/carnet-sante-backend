const { Op } = require('sequelize');
const { Appointment, User, DoctorAvailability, sequelize } = require('../models');
const { v4: uuidv4 } = require('uuid');

/**
 * Générer les créneaux par défaut (8h-17h, sauf 12h)
 */
const generateDefaultSlots = () => {
  const slots = [];
  for (let hour = 8; hour <= 17; hour++) {
    if (hour !== 12) { // Pause déjeuner
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }
  return slots;
};

/**
 * Convertir une date en format YYYY-MM-DD
 */
const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * Convertir une date en heure (HH:MM)
 */
const formatTime = (date) => {
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

/**
 * ✅ Récupérer TOUS les rendez-vous (sans filtre)
 */
exports.getAllAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.findAll({
      include: [
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'specialty', 'consultationPrice']
        }
      ],
      order: [['appointmentDate', 'DESC']]
    });

    res.json({
      success: true,
      data: { appointments }
    });
  } catch (error) {
    console.error('❌ Erreur getAllAppointments:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des rendez-vous'
    });
  }
};

/**
 * ✅ Récupérer les rendez-vous du patient connecté
 */
exports.getAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { filter } = req.query; // all, upcoming, past

    let whereClause = { patientId: userId };

    // Appliquer les filtres
    if (filter === 'upcoming') {
      whereClause.appointmentDate = { [Op.gte]: new Date() };
      whereClause.status = { [Op.notIn]: ['cancelled', 'completed', 'no_show'] };
    } else if (filter === 'past') {
      whereClause = {
        patientId: userId,
        [Op.or]: [
          { appointmentDate: { [Op.lt]: new Date() } },
          { status: { [Op.in]: ['cancelled', 'completed', 'no_show'] } }
        ]
      };
    }

    const appointments = await Appointment.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'specialty', 'consultationPrice']
        }
      ],
      order: [['appointmentDate', filter === 'past' ? 'DESC' : 'ASC']]
    });

    res.json({
      success: true,
      data: { appointments }
    });
  } catch (error) {
    console.error('❌ Erreur getAppointments:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des rendez-vous'
    });
  }
};

/**
 * ✅ Récupérer un rendez-vous par ID
 */
exports.getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findByPk(id, {
      include: [
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'specialty', 'consultationPrice']
        }
      ]
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }

    res.json({
      success: true,
      data: { appointment }
    });
  } catch (error) {
    console.error('❌ Erreur getAppointmentById:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du rendez-vous'
    });
  }
};

/**
 * ✅ CRÉER un rendez-vous avec VÉRIFICATION de DISPONIBILITÉ
 */
exports.createAppointment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { doctorId, appointmentDate, duration = 30, type = 'in_person', reason, notes = '' } = req.body;
    const patientId = req.user.id;

    // Validation
    if (!doctorId || !appointmentDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'doctorId, appointmentDate et reason sont requis'
      });
    }

    // Vérifier que le médecin existe
    const doctor = await User.findOne({
      where: { id: doctorId, role: 'doctor' }
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Médecin non trouvé'
      });
    }

    // Extraire la date et l'heure
    const appointmentDateTime = new Date(appointmentDate);
    const dateStr = formatDate(appointmentDateTime);
    const timeStr = formatTime(appointmentDateTime);

    // ✅ VÉRIFICATION CRITIQUE : Créneau déjà réservé ?
    const existingAppointment = await Appointment.findOne({
      where: {
        doctorId,
        status: { [Op.notIn]: ['cancelled', 'completed'] },
        [Op.and]: sequelize.where(
          sequelize.fn('DATE', sequelize.col('appointmentDate')),
          '=',
          dateStr
        ),
        [Op.and]: sequelize.where(
          sequelize.fn('TO_CHAR', sequelize.col('appointmentDate'), 'HH24:MI'),
          '=',
          timeStr
        )
      }
    });

    if (existingAppointment) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: 'Ce créneau est déjà réservé. Veuillez en choisir un autre.'
      });
    }

    // ✅ CRÉER le rendez-vous
    const appointment = await Appointment.create({
      id: uuidv4(),
      patientId,
      doctorId,
      appointmentDate: appointmentDateTime,
      duration,
      status: 'pending',
      type,
      reason,
      notes
    }, { transaction });

    await transaction.commit();

    // Récupérer le rendez-vous avec les associations
    const createdAppointment = await Appointment.findByPk(appointment.id, {
      include: [
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'specialty']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Rendez-vous créé avec succès',
      data: { appointment: createdAppointment }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Erreur createAppointment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du rendez-vous'
    });
  }
};

/**
 * ✅ RÉCUPÉRER les créneaux DISPONIBLES pour un médecin
 */
exports.getDoctorAvailableSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Le paramètre date est requis (YYYY-MM-DD)'
      });
    }

    // 1. Vérifier que le médecin existe
    const doctor = await User.findOne({
      where: { id: doctorId, role: 'doctor' }
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Médecin non trouvé'
      });
    }

    // 2. Récupérer les créneaux déjà réservés pour cette date
    const bookedAppointments = await Appointment.findAll({
      where: {
        doctorId,
        status: { [Op.notIn]: ['cancelled', 'completed'] },
        [Op.and]: sequelize.where(
          sequelize.fn('DATE', sequelize.col('appointmentDate')),
          '=',
          date
        )
      }
    });

    // 3. Extraire les heures réservées
    const bookedSlots = bookedAppointments.map(apt => {
      return formatTime(apt.appointmentDate);
    });

    // 4. TOUJOURS retourner des créneaux (par défaut)
    let availableSlots = generateDefaultSlots();

    // 5. Filtrer les créneaux déjà réservés
    availableSlots = availableSlots.filter(slot => !bookedSlots.includes(slot));

    res.json({
      success: true,
      data: {
        availableSlots,
        bookedSlots,
        total: availableSlots.length,
        date,
        doctorId
      }
    });

  } catch (error) {
    console.error('❌ Erreur getDoctorAvailableSlots:', error);
    
    // En cas d'erreur, retourner quand même des créneaux par défaut
    res.json({
      success: true,
      data: {
        availableSlots: generateDefaultSlots(),
        bookedSlots: [],
        total: generateDefaultSlots().length,
        date: req.query.date,
        doctorId: req.params.doctorId
      }
    });
  }
};

/**
 * ✅ RÉCUPÉRER les créneaux RÉSERVÉS pour un médecin
 */
exports.getDoctorBookedSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Le paramètre date est requis (YYYY-MM-DD)'
      });
    }

    const bookedAppointments = await Appointment.findAll({
      where: {
        doctorId,
        status: { [Op.notIn]: ['cancelled', 'completed'] },
        [Op.and]: sequelize.where(
          sequelize.fn('DATE', sequelize.col('appointmentDate')),
          '=',
          date
        )
      }
    });

    const bookedSlots = bookedAppointments.map(apt => formatTime(apt.appointmentDate));

    res.json({
      success: true,
      data: {
        bookedSlots,
        total: bookedSlots.length,
        date,
        doctorId
      }
    });

  } catch (error) {
    console.error('❌ Erreur getDoctorBookedSlots:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des créneaux réservés'
    });
  }
};

/**
 * ✅ RÉCUPÉRER tous les médecins
 */
exports.getDoctors = async (req, res) => {
  try {
    const doctors = await User.findAll({
      where: { role: 'doctor', isActive: true },
      attributes: ['id', 'firstName', 'lastName', 'specialty', 'consultationPrice', 'rating']
    });

    res.json({
      success: true,
      data: { doctors }
    });
  } catch (error) {
    console.error('❌ Erreur getDoctors:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des médecins'
    });
  }
};

/**
 * ✅ ANNULER un rendez-vous
 */
exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }

    // Vérifier les permissions
    if (appointment.patientId !== req.user.id && req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    appointment.status = 'cancelled';
    appointment.cancellationReason = reason || 'Annulé par le patient';
    await appointment.save();

    res.json({
      success: true,
      message: 'Rendez-vous annulé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur cancelAppointment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation du rendez-vous'
    });
  }
};

/**
 * ✅ CONFIRMER un rendez-vous (docteur)
 */
exports.confirmAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }

    // Seul le docteur peut confirmer
    if (appointment.doctorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    appointment.status = 'confirmed';
    await appointment.save();

    res.json({
      success: true,
      message: 'Rendez-vous confirmé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur confirmAppointment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la confirmation du rendez-vous'
    });
  }
};

/**
 * ✅ MARQUER comme TERMINÉ
 */
exports.completeAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Rendez-vous non trouvé'
      });
    }

    if (appointment.doctorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    appointment.status = 'completed';
    if (notes) appointment.notes = notes;
    await appointment.save();

    res.json({
      success: true,
      message: 'Rendez-vous marqué comme terminé'
    });

  } catch (error) {
    console.error('❌ Erreur completeAppointment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la finalisation du rendez-vous'
    });
  }
};

/**
 * ✅ STATISTIQUES du dashboard
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let whereClause = {};
    
    if (userRole === 'doctor') {
      whereClause.doctorId = userId;
    } else {
      whereClause.patientId = userId;
    }

    const totalAppointments = await Appointment.count({ where: whereClause });
    
    const todayAppointments = await Appointment.count({
      where: {
        ...whereClause,
        appointmentDate: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        }
      }
    });

    const totalPatients = userRole === 'doctor' 
      ? await Appointment.count({
          where: { doctorId: userId },
          distinct: true,
          col: 'patientId'
        })
      : 1;

    res.json({
      success: true,
      data: {
        stats: {
          totalAppointments,
          todayAppointments,
          totalPatients
        }
      }
    });

  } catch (error) {
    console.error('❌ Erreur getDashboardStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};
