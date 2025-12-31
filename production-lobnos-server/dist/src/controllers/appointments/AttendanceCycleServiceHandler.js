"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmployeeAttendanceSummaryHandler = exports.deleteAttendanceCycleHandler = exports.updateAttendanceCycleHandler = exports.getAttendanceCycleHandler = exports.getAllAttendanceCyclesHandler = exports.createAttendanceCycleHandler = void 0;
const attendanceCycle_1 = __importDefault(require("../../models/appointments/attendanceCycle"));
const helper_1 = require("../../hooks/helper");
const createAccount_1 = require("../../LobnosAuth/createAccount");
const ShiftsPreferenceAndAvailabillity_1 = __importDefault(require("../../models/appointments/ShiftsPreferenceAndAvailabillity"));
const shfitsServices_1 = __importDefault(require("../../models/appointments/shfitsServices"));
const createAttendanceCycleHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const tenantIdP = parseInt(tenantId.toString());
        const cycle = await attendanceCycle_1.default.createAttendanceCycle(tenantIdP, req.body);
        return res.status(201).json({ success: true, data: cycle });
    }
    catch (error) {
        console.error("Error creating attendance cycle:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
exports.createAttendanceCycleHandler = createAttendanceCycleHandler;
const getAllAttendanceCyclesHandler = async (_req, res) => {
    try {
        const { tenantId } = _req.query;
        const tenantIdP = parseInt(tenantId.toString());
        const cycles = await attendanceCycle_1.default.getAllAttendanceCycles(tenantIdP);
        return res.status(200).json({ success: true, data: cycles });
    }
    catch (error) {
        console.error("Error fetching attendance cycles:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
exports.getAllAttendanceCyclesHandler = getAllAttendanceCyclesHandler;
const getAttendanceCycleHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { id } = req.params;
        const tenantIdP = parseInt(tenantId.toString());
        const cycle = await attendanceCycle_1.default.getAttendanceCycleById(tenantIdP, Number(id));
        if (!cycle) {
            return res.status(404).json({ success: false, message: "Attendance cycle not found" });
        }
        return res.status(200).json({ success: true, data: cycle });
    }
    catch (error) {
        console.error("Error fetching attendance cycle:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
exports.getAttendanceCycleHandler = getAttendanceCycleHandler;
const updateAttendanceCycleHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { id } = req.params;
        const updates = req.body;
        const tenantIdP = parseInt(tenantId.toString());
        const updatedRows = await attendanceCycle_1.default.updateAttendanceCycle(tenantIdP, Number(id), updates);
        if (!updatedRows) {
            return res.status(404).json({ success: false, message: "Attendance cycle not found or no changes made" });
        }
        return res.status(200).json({ success: true, message: "Attendance cycle updated successfully" });
    }
    catch (error) {
        console.error("Error updating attendance cycle:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
exports.updateAttendanceCycleHandler = updateAttendanceCycleHandler;
const deleteAttendanceCycleHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const tenantIdP = parseInt(tenantId.toString());
        const { id } = req.params;
        const deletedRows = await attendanceCycle_1.default.deleteAttendanceCycle(tenantIdP, Number(id));
        if (!deletedRows) {
            return res.status(404).json({ success: false, message: "Attendance cycle not found" });
        }
        return res.status(200).json({ success: true, message: "Attendance cycle deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting attendance cycle:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
exports.deleteAttendanceCycleHandler = deleteAttendanceCycleHandler;
const getEmployeeAttendanceSummaryHandler = async (request, response) => {
    try {
        const { tenantId } = request.query;
        const cycleid = request.params.cycleid;
        const tenantIdP = parseInt(tenantId.toString());
        const employeesList = await (0, createAccount_1.getAllLogins)(tenantIdP, request.query);
        if (!Array.isArray(employeesList) || employeesList.length === 0) {
            return response.send({ summary: [], shifts: [] });
        }
        const cycleInfo = await attendanceCycle_1.default.getAttendanceCycleById(tenantIdP, cycleid);
        const summary = await Promise.all(employeesList.map(async (item) => {
            const [preferredShifts, unAvailableDays] = await Promise.all([
                ShiftsPreferenceAndAvailabillity_1.default.getPreferredShift(item.employeeid, tenantIdP),
                ShiftsPreferenceAndAvailabillity_1.default.getUnavailableDay(item.employeeid, tenantIdP)
            ]);
            return Object.assign(Object.assign({}, item), { preferredShifts,
                unAvailableDays });
        }));
        const shiftsServices = await shfitsServices_1.default.getAllShifts(tenantIdP);
        response.send({
            cycleInfo,
            summary,
            shifts: shiftsServices,
        });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getEmployeeAttendanceSummaryHandler = getEmployeeAttendanceSummaryHandler;
