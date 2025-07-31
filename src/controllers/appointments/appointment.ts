import {
  MonthAppointmentsController,
  getPatientAppointmentHistoryController,
  createAppointmentController,
  loadPractionerAvailableSlotsController,
  updateAppointmentController,
  deleteAppointmentController,
  getAppointmentDetailsController,
  getAllAppointmentsController,
} from "./controllerAppointment";

const router = require("express").Router();




router.get("/api/v1/appointments", getAllAppointmentsController);
router.get("/api/v1/appointments/month", MonthAppointmentsController);
router.get("/api/v1/appointments/client/previous", getPatientAppointmentHistoryController);
router.post("/api/v1/appointments/create", createAppointmentController);
router.get("/api/v1/appointments/practioner/slots", loadPractionerAvailableSlotsController);
router.get("/api/v1/appointments/:id", getAppointmentDetailsController);
router.put("/api/v1/appointments/:id", updateAppointmentController);
router.delete("/api/v1/appointments/:id", deleteAppointmentController);

export default router;
