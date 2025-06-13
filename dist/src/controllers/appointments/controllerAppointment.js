"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPractionerAvailableSlotsController = exports.MonthAppointmentsController = exports.getPatientAppointmentHistoryController = exports.createAppointmentController = void 0;
const helper_1 = require("../../hooks/helper");
const appointments_1 = __importDefault(require("../../models/appointments/appointments"));
async function createAppointmentController(request, response) {
    try {
        const tenantId = parseInt(request.query.tenant, 10);
        const isAppointmentCreated = await new appointments_1.default(21).createAppointment(tenantId, request.body);
        response.send({ success: isAppointmentCreated });
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
}
exports.createAppointmentController = createAppointmentController;
async function getPatientAppointmentHistoryController(request, response) {
    try {
        const tenantId = parseInt(request.query.tenant, 10);
        let { patientid, count, page } = request.query;
        if (!patientid) {
            return (0, helper_1.customError)("Patient ID missing", 404, response);
        }
        const ptid = typeof patientid === "string" && !isNaN(Number(patientid)) ? parseInt(patientid) : Number(patientid);
        const reqPage = parseInt(page);
        const reqCount = parseInt(count);
        const previous = await new appointments_1.default(0).getPatientAppointmentHistory(tenantId, ptid, reqCount, reqPage);
        response.send(previous);
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
}
exports.getPatientAppointmentHistoryController = getPatientAppointmentHistoryController;
async function MonthAppointmentsController(request, response) {
    try {
        const tenantId = parseInt(request.query.tenant, 10);
        let { month = (new Date().getMonth() + 1).toString() } = request.query;
        const searchMonth = typeof month === "string" && !isNaN(Number(month)) ? parseInt(month) : Number(month);
        const records = await new appointments_1.default(null).loadMonthAppointments(tenantId, searchMonth);
        response.send(records);
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
}
exports.MonthAppointmentsController = MonthAppointmentsController;
async function loadPractionerAvailableSlotsController(request, response) {
    try {
        const tenantId = parseInt(request.query.tenant, 10);
        const { employeeid, appointment_date = new Date().toISOString() } = request.query;
        if (!employeeid || isNaN(Number(employeeid))) {
            return (0, helper_1.customError)("Bad Request. Employee ID not provided", 404, response);
        }
        const slots = await new appointments_1.default(Number(employeeid)).getPractionerAvailableTime(tenantId, Number(employeeid), new Date(appointment_date));
        response.send(slots);
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
}
exports.loadPractionerAvailableSlotsController = loadPractionerAvailableSlotsController;
