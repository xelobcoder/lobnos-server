"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllAppointmentsController = getAllAppointmentsController;
exports.getAppointmentDetailsController = getAppointmentDetailsController;
exports.updateAppointmentController = updateAppointmentController;
exports.deleteAppointmentController = deleteAppointmentController;
exports.createAppointmentController = createAppointmentController;
exports.getPatientAppointmentHistoryController = getPatientAppointmentHistoryController;
exports.MonthAppointmentsController = MonthAppointmentsController;
exports.loadPractionerAvailableSlotsController = loadPractionerAvailableSlotsController;
const zod_1 = require("zod");
const helper_1 = require("../../hooks/helper");
const appointments_1 = __importDefault(require("../../models/appointments/appointments"));
const NotificationDispatcher_1 = require("../../models/application/notifications/services/NotificationDispatcher");
async function getAllAppointmentsController(request, response) {
    try {
        const tenantId = parseInt(request.query.tenant, 10);
        const page = request.query.page ? parseInt(request.query.page, 10) : 1;
        const count = request.query.count ? parseInt(request.query.count, 10) : 10;
        const sortby = request.query.sortby || 'DESC';
        const employeeId = request.query.employeeid ? parseInt(request.query.employeeid, 10) : 0;
        const result = await new appointments_1.default(employeeId).getAllAppointments(tenantId, page, count, sortby);
        response.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
}
async function getAppointmentDetailsController(request, response) {
    try {
        const tenantId = parseInt(request.query.tenant, 10);
        const appointmentId = parseInt(request.params.id.toString(), 10);
        if (!appointmentId) {
            return (0, helper_1.customError)("Appointment ID missing", 404, response);
        }
        const details = await new appointments_1.default(0).getAppointmentDetails(tenantId, appointmentId);
        if (!details) {
            return (0, helper_1.customError)("Appointment not found", 404, response);
        }
        response.send(details);
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
}
async function updateAppointmentController(request, response) {
    try {
        const tenantId = parseInt(request.query.tenant, 10);
        const appointmentId = parseInt(request.params.id.toString(), 10);
        if (!appointmentId)
            return (0, helper_1.customError)("Appointment ID missing", 404, response);
        const _a = request.body, { refid, appointment_date } = _a, rest = __rest(_a, ["refid", "appointment_date"]);
        let processedDate = appointment_date;
        if (appointment_date && appointment_date.includes("T")) {
            processedDate = appointment_date.split("T")[0];
        }
        const cleanPayload = Object.assign({}, rest);
        if (processedDate)
            cleanPayload["appointment_date"] = processedDate;
        // Use the same Zod schema as in the model for validation
        const updateSchema = zod_1.z.object({
            patientid: zod_1.z.number().int(),
            duration: zod_1.z.number().int().optional(),
            status: zod_1.z.string().max(50).optional(),
            appointment_time: zod_1.z.string().max(10).optional(),
            appointment_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            inviteMethod: zod_1.z.string().optional(),
            purpose: zod_1.z.string(),
            title: zod_1.z.string().optional(),
            preference: zod_1.z.string().optional(),
            practioner: zod_1.z.number().int().optional(),
            location: zod_1.z.string().optional(),
            notes: zod_1.z.string().nullable().optional(),
        }).strict();
        const unParsedCleanPayload = {
            patientid: cleanPayload.patientid,
            duration: cleanPayload.duration,
            status: cleanPayload.status,
            appointment_time: cleanPayload.appointment_time,
            appointment_date: cleanPayload.appointment_date,
            inviteMethod: cleanPayload.inviteMethod,
            purpose: cleanPayload.purpose,
            title: cleanPayload.title,
            preference: cleanPayload.preference,
            practioner: cleanPayload.practionerid,
            location: cleanPayload.location,
            notes: cleanPayload.notes,
        };
        const parseResult = updateSchema.safeParse(unParsedCleanPayload);
        if (!parseResult.success) {
            console.error("Zod validation error:", parseResult.error);
            return (0, helper_1.customError)("Invalid appointment update fields", 400, response);
        }
        const updated = await new appointments_1.default(0).updateAppointment(tenantId, appointmentId, unParsedCleanPayload);
        if (updated) {
            const status = String(unParsedCleanPayload.status || '').toLowerCase();
            const employeeid = request.query.employeeid ? parseInt(request.query.employeeid, 10) : undefined;
            let eventCode = null;
            if (status === 'confirmed' || status === 'confirm')
                eventCode = 'APPOINTMENT_CONFIRMED';
            else if (status === 'cancelled' || status === 'canceled' || status === 'cancel')
                eventCode = 'APPOINTMENT_CANCELLED';
            else if (status === 'missed' || status === 'no_show' || status === 'noshow')
                eventCode = 'APPOINTMENT_MISSED';
            else if (unParsedCleanPayload.appointment_date || unParsedCleanPayload.appointment_time)
                eventCode = 'APPOINTMENT_RESCHEDULED';
            if (eventCode) {
                NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, eventCode, { appointmentId }, employeeid && !isNaN(employeeid) ? employeeid : undefined).catch(() => { });
            }
        }
        response.send({ success: updated });
    }
    catch (err) {
        console.log("Error updating appointment:", err);
        (0, helper_1.responseError)(response, err);
    }
}
async function deleteAppointmentController(request, response) {
    try {
        const tenantId = parseInt(request.query.tenant, 10);
        const appointmentId = parseInt(request.params.id.toString(), 10);
        if (!appointmentId) {
            return (0, helper_1.customError)("Appointment ID missing", 404, response);
        }
        const deleted = await new appointments_1.default(0).deleteAppointment(tenantId, appointmentId);
        if (deleted) {
            const employeeid = request.query.employeeid ? parseInt(request.query.employeeid, 10) : undefined;
            NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, 'APPOINTMENT_CANCELLED', { appointmentId }, employeeid && !isNaN(employeeid) ? employeeid : undefined).catch(() => { });
        }
        response.send({ success: deleted });
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
}
async function createAppointmentController(request, response) {
    var _a, _b, _c, _d;
    try {
        const tenantRaw = ((_a = request.query.tenantId) !== null && _a !== void 0 ? _a : request.query.tenant);
        const tenantId = parseInt(tenantRaw, 10);
        const employeeid = request.query.employeeid ? parseInt(request.query.employeeid, 10) : 0;
        if (!tenantId || Number.isNaN(tenantId))
            return (0, helper_1.customError)("Tenant ID missing in query", 404, response);
        if (!employeeid)
            return (0, helper_1.customError)("Employee ID missing in query", 404, response);
        const isAppointmentCreated = await new appointments_1.default(employeeid).createAppointment(tenantId, request.body);
        const createdId = (isAppointmentCreated === null || isAppointmentCreated === void 0 ? void 0 : isAppointmentCreated.appointmentId)
            || (isAppointmentCreated === null || isAppointmentCreated === void 0 ? void 0 : isAppointmentCreated.refid)
            || (isAppointmentCreated === null || isAppointmentCreated === void 0 ? void 0 : isAppointmentCreated.id)
            || ((_b = request.body) === null || _b === void 0 ? void 0 : _b.refid)
            || ((_c = request.body) === null || _c === void 0 ? void 0 : _c.appointmentId);
        const createdOk = Boolean(isAppointmentCreated) && isAppointmentCreated !== false;
        if (createdOk && createdId) {
            NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, 'APPOINTMENT_CREATED', {
                appointmentId: Number(createdId),
                patientId: ((_d = request.body) === null || _d === void 0 ? void 0 : _d.patientid) ? Number(request.body.patientid) : undefined,
            }, employeeid).then((result) => {
                if (!result.success) {
                    console.warn('[notifications] APPOINTMENT_CREATED not queued:', result.reason || result.error);
                }
            }).catch((err) => {
                console.error('[notifications] APPOINTMENT_CREATED dispatch error:', err);
            });
        }
        else if (createdOk && !createdId) {
            console.warn('[notifications] APPOINTMENT_CREATED skipped: appointment created but no id returned');
        }
        response.send({ success: isAppointmentCreated });
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
}
async function getPatientAppointmentHistoryController(request, response) {
    try {
        const tenantId = parseInt(request.query.tenant, 10);
        let { patientid, count, page } = request.query;
        if (!patientid) {
            return (0, helper_1.customError)("Patient ID missing", 404, response);
        }
        const ptid = typeof patientid === "string" && !isNaN(Number(patientid)) ? parseInt(patientid) : Number(patientid);
        const reqPage = parseInt(page) || 1;
        const reqCount = parseInt(count) || 10;
        const previous = await new appointments_1.default(0).getPatientAppointmentHistory(tenantId, ptid, reqCount, reqPage);
        response.send(previous);
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
}
async function MonthAppointmentsController(request, response) {
    try {
        const tenantId = parseInt(request.query.tenant, 10);
        let { month = (new Date().getMonth() + 1).toString() } = request.query;
        const searchMonth = typeof month === "string" && !isNaN(Number(month)) ? parseInt(month) : Number(month);
        const records = await new appointments_1.default(0).loadMonthAppointments(tenantId, searchMonth);
        response.send(records);
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
}
async function loadPractionerAvailableSlotsController(request, response) {
    try {
        const tenantId = parseInt(request.query.tenant, 10);
        const { employeeid, appointment_date = new Date() } = request.query;
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
