"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const controllerAppointment_1 = require("./controllerAppointment");
const router = require("express").Router();
router.get("/api/v1/appointments/month", controllerAppointment_1.MonthAppointmentsController);
router.get("/api/v1/appointments/client/previous", controllerAppointment_1.getPatientAppointmentHistoryController);
router.post("/api/v1/appointments/create", controllerAppointment_1.createAppointmentController);
router.get("/api/v1/appointments/practioner/slots", controllerAppointment_1.loadPractionerAvailableSlotsController);
exports.default = router;
