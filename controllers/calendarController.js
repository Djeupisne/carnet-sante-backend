const { Calendar, User } = require('../models');

const calendarController = {
  // Récupérer tous les calendriers (pour l'admin)
  async getAllCalendars(req, res) {
    try {
      console.log('📅 Récupération de tous les calendriers...');
      
      const calendars = await Calendar.findAll({
        include: [{
          model: User,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName']
        }],
        order: [['date', 'DESC']]
      });
      
      res.json({
        success: true,
        data: calendars
      });
    } catch (error) {
      console.error('❌ Erreur getAllCalendars:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération des calendriers' 
      });
    }
  },

  // Récupérer les calendriers d'un médecin
  async getDoctorCalendars(req, res) {
    try {
      const doctorId = req.user.id;
      console.log(`📅 Récupération des calendriers du médecin ${doctorId}...`);

      const calendars = await Calendar.findAll({
        where: { doctorId },
        order: [['date', 'ASC']]
      });

      res.json({
        success: true,
        data: calendars
      });
    } catch (error) {
      console.error('❌ Erreur getDoctorCalendars:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération des calendriers' 
      });
    }
  },

  // Créer un calendrier
  async createCalendar(req, res) {
    try {
      const { date, slots } = req.body;
      const doctorId = req.user.id;

      console.log(`📅 Création d'un calendrier pour le médecin ${doctorId} le ${date}`);

      const existingCalendar = await Calendar.findOne({
        where: { doctorId, date }
      });

      if (existingCalendar) {
        return res.status(400).json({
          success: false,
          message: 'Un calendrier existe déjà pour cette date'
        });
      }

      const calendar = await Calendar.create({
        doctorId,
        date,
        slots: slots || [],
        confirmed: false,
        versions: []
      });

      res.status(201).json({
        success: true,
        data: calendar
      });
    } catch (error) {
      console.error('❌ Erreur createCalendar:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la création du calendrier' 
      });
    }
  },

  // Mettre à jour un calendrier
  async updateCalendar(req, res) {
    try {
      const { id } = req.params;
      const { date, slots, confirmed } = req.body;

      console.log(`📅 Mise à jour du calendrier ${id}...`);

      const calendar = await Calendar.findByPk(id);

      if (!calendar) {
        return res.status(404).json({
          success: false,
          message: 'Calendrier non trouvé'
        });
      }

      // Vérifier que le médecin est propriétaire
      if (calendar.doctorId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Non autorisé'
        });
      }

      await calendar.update({
        date: date || calendar.date,
        slots: slots || calendar.slots,
        confirmed: confirmed !== undefined ? confirmed : calendar.confirmed
      });

      res.json({
        success: true,
        data: calendar
      });
    } catch (error) {
      console.error('❌ Erreur updateCalendar:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la mise à jour du calendrier' 
      });
    }
  },

  // Supprimer un calendrier
  async deleteCalendar(req, res) {
    try {
      const { id } = req.params;

      console.log(`📅 Suppression du calendrier ${id}...`);

      const calendar = await Calendar.findByPk(id);

      if (!calendar) {
        return res.status(404).json({
          success: false,
          message: 'Calendrier non trouvé'
        });
      }

      // Vérifier que le médecin est propriétaire ou admin
      if (calendar.doctorId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Non autorisé'
        });
      }

      await calendar.destroy();

      res.json({
        success: true,
        message: 'Calendrier supprimé avec succès'
      });
    } catch (error) {
      console.error('❌ Erreur deleteCalendar:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la suppression du calendrier' 
      });
    }
  },

  // Confirmer un calendrier
  async confirmCalendar(req, res) {
    try {
      const { id } = req.params;

      console.log(`📅 Confirmation du calendrier ${id}...`);

      const calendar = await Calendar.findByPk(id);

      if (!calendar) {
        return res.status(404).json({
          success: false,
          message: 'Calendrier non trouvé'
        });
      }

      await calendar.update({ confirmed: true });

      res.json({
        success: true,
        data: calendar
      });
    } catch (error) {
      console.error('❌ Erreur confirmCalendar:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la confirmation du calendrier' 
      });
    }
  },

  // Récupérer les créneaux disponibles
  async getAvailableSlots(req, res) {
    try {
      const { doctorId } = req.params;
      const { date } = req.query;

      console.log(`📅 Récupération des créneaux disponibles pour le médecin ${doctorId} le ${date}`);

      const calendar = await Calendar.findOne({
        where: { doctorId, date }
      });

      if (!calendar) {
        return res.json({
          success: true,
          data: {
            availableSlots: [],
            bookedSlots: []
          }
        });
      }

      // Logique pour déterminer les créneaux disponibles
      // (à adapter selon votre modèle de rendez-vous)
      const { Appointment } = require('../models');
      const bookedAppointments = await Appointment.findAll({
        where: {
          doctorId,
          appointmentDate: {
            [Op.between]: [
              new Date(date + 'T00:00:00'),
              new Date(date + 'T23:59:59')
            ]
          }
        }
      });

      const bookedSlots = bookedAppointments.map(apt => {
        const aptDate = new Date(apt.appointmentDate);
        return `${aptDate.getHours().toString().padStart(2, '0')}:${aptDate.getMinutes().toString().padStart(2, '0')}`;
      });

      const availableSlots = calendar.slots.filter(slot => !bookedSlots.includes(slot));

      res.json({
        success: true,
        data: {
          availableSlots,
          bookedSlots,
          total: availableSlots.length
        }
      });
    } catch (error) {
      console.error('❌ Erreur getAvailableSlots:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération des créneaux' 
      });
    }
  }
};

module.exports = calendarController;
