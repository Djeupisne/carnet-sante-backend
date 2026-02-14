const { User, Appointment } = require('../models');
const { Op } = require('sequelize');

const doctorController = {
  // Récupérer tous les médecins
  async getAllDoctors(req, res) {
    try {
      console.log('👨‍⚕️ Récupération de tous les médecins...');

      const doctors = await User.findAll({
        where: { 
          role: 'doctor',
          isActive: true 
        },
        attributes: { 
          exclude: ['password', 'resetToken', 'resetTokenExpiry'] 
        },
        order: [['lastName', 'ASC'], ['firstName', 'ASC']]
      });

      // Pour chaque médecin, compter le nombre de patients
      const doctorsWithStats = await Promise.all(doctors.map(async (doctor) => {
        const patientsCount = await Appointment.count({
          where: { doctorId: doctor.id },
          distinct: true,
          col: 'patientId'
        });

        const appointmentsCount = await Appointment.count({
          where: { doctorId: doctor.id }
        });

        const upcomingAppointments = await Appointment.count({
          where: { 
            doctorId: doctor.id,
            appointmentDate: { [Op.gte]: new Date() },
            status: { [Op.in]: ['pending', 'confirmed'] }
          }
        });

        return {
          ...doctor.toJSON(),
          stats: {
            patients: patientsCount,
            totalAppointments: appointmentsCount,
            upcomingAppointments
          }
        };
      }));

      res.json({
        success: true,
        data: doctorsWithStats,
        count: doctorsWithStats.length
      });

    } catch (error) {
      console.error('❌ Erreur getAllDoctors:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération des médecins' 
      });
    }
  },

  // Récupérer un médecin par son ID
  async getDoctorById(req, res) {
    try {
      const { id } = req.params;
      console.log(`👨‍⚕️ Récupération du médecin ${id}...`);

      const doctor = await User.findOne({
        where: { 
          id, 
          role: 'doctor' 
        },
        attributes: { 
          exclude: ['password', 'resetToken', 'resetTokenExpiry'] 
        }
      });

      if (!doctor) {
        return res.status(404).json({ 
          success: false, 
          message: 'Médecin non trouvé' 
        });
      }

      // Statistiques du médecin
      const patientsCount = await Appointment.count({
        where: { doctorId: id },
        distinct: true,
        col: 'patientId'
      });

      const appointmentsCount = await Appointment.count({
        where: { doctorId: id }
      });

      const upcomingAppointments = await Appointment.count({
        where: { 
          doctorId: id,
          appointmentDate: { [Op.gte]: new Date() },
          status: { [Op.in]: ['pending', 'confirmed'] }
        }
      });

      const completedAppointments = await Appointment.count({
        where: { 
          doctorId: id,
          status: 'completed'
        }
      });

      // Récupérer les derniers rendez-vous
      const recentAppointments = await Appointment.findAll({
        where: { doctorId: id },
        limit: 5,
        order: [['appointmentDate', 'DESC']],
        include: [{
          model: User,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName']
        }]
      });

      const doctorData = {
        ...doctor.toJSON(),
        stats: {
          patients: patientsCount,
          totalAppointments: appointmentsCount,
          upcomingAppointments,
          completedAppointments
        },
        recentAppointments
      };

      res.json({
        success: true,
        data: doctorData
      });

    } catch (error) {
      console.error('❌ Erreur getDoctorById:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération du médecin' 
      });
    }
  },

  // Récupérer tous les patients d'un médecin
  async getDoctorPatients(req, res) {
    try {
      const { id } = req.params;
      console.log(`👥 Récupération des patients du médecin ${id}...`);

      // Vérifier que le médecin existe
      const doctor = await User.findOne({
        where: { id, role: 'doctor' }
      });

      if (!doctor) {
        return res.status(404).json({ 
          success: false, 
          message: 'Médecin non trouvé' 
        });
      }

      // Récupérer tous les IDs uniques des patients qui ont eu des rendez-vous avec ce médecin
      const appointments = await Appointment.findAll({
        where: { doctorId: id },
        attributes: ['patientId'],
        group: ['patientId']
      });

      const patientIds = appointments.map(apt => apt.patientId);

      if (patientIds.length === 0) {
        return res.json({
          success: true,
          data: [],
          count: 0,
          doctor: {
            id: doctor.id,
            firstName: doctor.firstName,
            lastName: doctor.lastName,
            specialty: doctor.specialty
          }
        });
      }

      // Récupérer les détails des patients
      const patients = await User.findAll({
        where: { 
          id: { [Op.in]: patientIds },
          role: 'patient'
        },
        attributes: { 
          exclude: ['password', 'resetToken', 'resetTokenExpiry'] 
        },
        order: [['lastName', 'ASC'], ['firstName', 'ASC']]
      });

      // Pour chaque patient, ajouter des statistiques
      const patientsWithStats = await Promise.all(patients.map(async (patient) => {
        const patientAppointments = await Appointment.findAll({
          where: { 
            patientId: patient.id,
            doctorId: id 
          },
          order: [['appointmentDate', 'DESC']],
          attributes: ['id', 'appointmentDate', 'status', 'type', 'reason']
        });

        return {
          ...patient.toJSON(),
          appointments: patientAppointments,
          totalAppointments: patientAppointments.length,
          lastAppointment: patientAppointments[0] || null
        };
      }));

      res.json({
        success: true,
        data: patientsWithStats,
        count: patientsWithStats.length,
        doctor: {
          id: doctor.id,
          firstName: doctor.firstName,
          lastName: doctor.lastName,
          specialty: doctor.specialty
        }
      });

    } catch (error) {
      console.error('❌ Erreur getDoctorPatients:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération des patients du médecin' 
      });
    }
  },

  // Récupérer les disponibilités d'un médecin (via calendrier)
  async getDoctorAvailability(req, res) {
    try {
      const { id } = req.params;
      const { date } = req.query;
      
      console.log(`📅 Récupération des disponibilités du médecin ${id} pour la date ${date || 'aujourd\'hui'}...`);

      const { Calendar } = require('../models');
      
      let whereClause = { doctorId: id };
      if (date) {
        whereClause.date = date;
      } else {
        const today = new Date().toISOString().split('T')[0];
        whereClause.date = today;
      }

      const calendar = await Calendar.findOne({
        where: whereClause
      });

      res.json({
        success: true,
        data: calendar || { doctorId: id, date: date || new Date().toISOString().split('T')[0], slots: [] }
      });

    } catch (error) {
      console.error('❌ Erreur getDoctorAvailability:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération des disponibilités' 
      });
    }
  }
};

module.exports = doctorController;
