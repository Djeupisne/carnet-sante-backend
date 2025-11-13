warning: in the working copy of 'controllers/appointmentController.js', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/controllers/appointmentController.js b/controllers/appointmentController.js[m
[1mindex 8e05cfa..e11a103 100644[m
[1m--- a/controllers/appointmentController.js[m
[1m+++ b/controllers/appointmentController.js[m
[36m@@ -597,4 +597,15 @@[m [mexports.rateAppointment = async (req, res) => {[m
       error: error.message[m
     });[m
   }[m
[32m+[m[32m};[m
[32m+[m[32m// Réexporter toutes les fonctions pour l'import avec require()[m
[32m+[m[32mmodule.exports = {[m
[32m+[m[32m  createAppointment: exports.createAppointment,[m
[32m+[m[32m  getAppointments: exports.getAppointments,[m
[32m+[m[32m  getAppointmentById: exports.getAppointmentById,[m
[32m+[m[32m  updateAppointmentStatus: exports.updateAppointmentStatus,[m
[32m+[m[32m  cancelAppointment: exports.cancelAppointment,[m
[32m+[m[32m  confirmAppointment: exports.confirmAppointment,[m
[32m+[m[32m  completeAppointment: exports.completeAppointment,[m
[32m+[m[32m  rateAppointment: exports.rateAppointment[m
 };[m
\ No newline at end of file[m
