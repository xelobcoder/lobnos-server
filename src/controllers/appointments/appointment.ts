import {
  MonthAppointmentsController,
  getPatientAppointmentHistoryController,
  createAppointmentController,
  loadPractionerAvailableSlotsController,
} from "./controllerAppointment";

const router = require("express").Router();

router.get("/api/v1/appointments/month", MonthAppointmentsController);
router.get("/api/v1/appointments/client/previous", getPatientAppointmentHistoryController);
router.post("/api/v1/appointments/create", createAppointmentController);
router.get("/api/v1/appointments/practioner/slots", loadPractionerAvailableSlotsController);

export default router;
