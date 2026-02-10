import { PhoneCallsTrackersController } from "./PhoneCallsTrackersController";
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
// Phone call log routes
router.post("/api/v1/appointment/reminder/phonecall", PhoneCallsTrackersController.createPhoneCallLog);
router.get("/api/v1/appointments/reminder/phonecalls/:id", PhoneCallsTrackersController.getPhoneCallLog);
router.put("/api/v1/appointments/reminder/phonecalls/:id", PhoneCallsTrackersController.updatePhoneCallLog);
router.get("/api/v1/appointments/reminder/phonecalls", PhoneCallsTrackersController.listPhoneCallLogs);
router.get("/api/v1/appointments/phonecalls/paginated", PhoneCallsTrackersController.listPhoneCallLogsWithPagination);
router.get("/api/v1/appointments/reminder/appointment/phonecalls/:appointment_refid", PhoneCallsTrackersController.getPhoneCallLogsByAppointmentRef);
router.post("/api/v1/appointment/reminder", PhoneCallsTrackersController.sendAppointmentReminders);
export default router;
