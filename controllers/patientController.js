const { User, Appointment } = require('../models');
const { Op } = require('sequelize');

const patientController = {
  // Récupérer tous les patients
  async getAllPatients(req, res) {
    try {
      console.log('👥 Récupération de tous les patients...');

      const patients = await User.findAll({
        where: { 
          role: 'patient',
          isActive: true 
        },
        attributes: { 
          exclude: ['password', 'resetToken', 'resetTokenExpiry'] 
        },
        order: [['lastName', 'ASC'], ['firstName', 'ASC']]
      });

      // Pour chaque patient, compter les rendez-vous
      const patientsWithStats = await Promise.all(patients.map(async (patient) => {
        const appointmentsCount = await Appointment.count({
          where: { patientId: patient.id }
        });

        const lastAppointment = await Appointment.findOne({
          where: { patientId: patient.id },
          order: [['appointmentDate', 'DESC']],
          include: [{
            model: User,
            as: 'doctor',
            attributes: ['id', 'firstName', 'lastName', 'specialty']
          }]
        });

        const upcomingAppointments = await Appointment.count({
          where: { 
            patientId: patient.id,
            appointmentDate: { [Op.gte]: new Date() },
            status: { [Op.in]: ['pending', 'confirmed'] }
          }
        });

        return {
          ...patient.toJSON(),
          stats: {
            totalAppointments: appointmentsCount,
            upcomingAppointments,
            lastAppointment: lastAppointment ? {
              date: lastAppointment.appointmentDate,
              status: lastAppointment.status,
              doctor: lastAppointment.doctor
            } : null
          }
        };
      }));

      res.json({
        success: true,
        data: patientsWithStats,
        count: patientsWithStats.length
      });

    } catch (error) {
      console.error('❌ Erreur getAllPatients:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération des patients' 
      });
    }
  },

  // Récupérer un patient par son ID
  async getPatientById(req, res) {
    try {
      const { id } = req.params;
      console.log(`👤 Récupération du patient ${id}...`);

      const patient = await User.findOne({
        where: { 
          id, 
          role: 'patient' 
        },
        attributes: { 
          exclude: ['password', 'resetToken', 'resetTokenExpiry'] 
        }
      });

      if (!patient) {
        return res.status(404).json({ 
          success: false, 
          message: 'Patient non trouvé' 
        });
      }

      // Récupérer l'historique des rendez-vous
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

      const upcomingAppointments = appointments.filter(apt => 
        new Date(apt.appointmentDate) > new Date() && 
        ['pending', 'confirmed'].includes(apt.status)
      );

      const completedAppointments = appointments.filter(apt => 
        apt.status === 'completed'
      );

      const patientData = {
        ...patient.toJSON(),
        appointments,
        stats: {
          totalAppointments: appointments.length,
          doctorsConsulted: doctorsCount,
          upcomingAppointments: upcomingAppointments.length,
          completedAppointments: completedAppointments.length
        }
      };

      res.json({
        success: true,
        data: patientData
      });

    } catch (error) {
      console.error('❌ Erreur getPatientById:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération du patient' 
      });
    }
  },

  // Récupérer tous les médecins d'un patient
  async getPatientDoctors(req, res) {
    try {
      const { id } = req.params;
      console.log(`👨‍⚕️ Récupération des médecins du patient ${id}...`);

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
      console.error('❌ Erreur getPatientDoctors:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération des médecins du patient' 
      });
    }
  },

  // Récupérer le prochain rendez-vous d'un patient
  async getNextAppointment(req, res) {
    try {
      const { id } = req.params;
      console.log(`📅 Récupération du prochain rendez-vous du patient ${id}...`);

      const nextAppointment = await Appointment.findOne({
        where: { 
          patientId: id,
          appointmentDate: { [Op.gte]: new Date() },
          status: { [Op.in]: ['pending', 'confirmed'] }
        },
        order: [['appointmentDate', 'ASC']],
        include: [{
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'specialty']
        }]
      });

      res.json({
        success: true,
        data: nextAppointment || null
      });

    } catch (error) {
      console.error('❌ Erreur getNextAppointment:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération du prochain rendez-vous' 
      });
    }
  }
};

module.exports = patientController;
