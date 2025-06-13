"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUnavailableDayHandler = exports.getUnavailableDayHandler = exports.getAllUnavailableDaysHandler = exports.createUnavailableDayHandler = exports.deletePreferredShiftHandler = exports.getPreferredShiftHandler = exports.getAllPreferredShiftsHandler = exports.createPreferredShiftHandler = void 0;
const ShiftsPreferenceAndAvailabillity_1 = __importDefault(require("../../models/appointments/ShiftsPreferenceAndAvailabillity"));
const createPreferredShiftHandler = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const record = req.body;
        const createdRecord = await ShiftsPreferenceAndAvailabillity_1.default.createPreferredShift(record, tenantId);
        res.status(201).json(createdRecord);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createPreferredShiftHandler = createPreferredShiftHandler;
const getAllPreferredShiftsHandler = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const records = await ShiftsPreferenceAndAvailabillity_1.default.getAllPreferredShifts(tenantId);
        res.status(200).json(records);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAllPreferredShiftsHandler = getAllPreferredShiftsHandler;
const getPreferredShiftHandler = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const { employeeid } = req.params;
        const record = await ShiftsPreferenceAndAvailabillity_1.default.getPreferredShift(Number(employeeid), tenantId);
        if (!record) {
            return res.status(404).json({ message: "Record not found" });
        }
        res.status(200).json(record);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPreferredShiftHandler = getPreferredShiftHandler;
const deletePreferredShiftHandler = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const { employeeid, shiftid } = req.params;
        const deletedCount = await ShiftsPreferenceAndAvailabillity_1.default.deletePreferredShift(Number(employeeid), Number(shiftid), tenantId);
        if (deletedCount === 0) {
            return res.status(404).json({ message: "Record not found" });
        }
        res.status(200).json({ message: "Record deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deletePreferredShiftHandler = deletePreferredShiftHandler;
const createUnavailableDayHandler = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const record = req.body;
        const createdRecord = await ShiftsPreferenceAndAvailabillity_1.default.createUnavailableDay(record, tenantId);
        res.status(201).json(createdRecord);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createUnavailableDayHandler = createUnavailableDayHandler;
const getAllUnavailableDaysHandler = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const records = await ShiftsPreferenceAndAvailabillity_1.default.getAllUnavailableDays(tenantId);
        res.status(200).json(records);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAllUnavailableDaysHandler = getAllUnavailableDaysHandler;
const getUnavailableDayHandler = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const { employeeid } = req.params;
        const record = await ShiftsPreferenceAndAvailabillity_1.default.getUnavailableDay(Number(employeeid), tenantId);
        console.log(record);
        if (!record) {
            return res.status(404).json({ message: "Record not found" });
        }
        res.status(200).json(record);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getUnavailableDayHandler = getUnavailableDayHandler;
const deleteUnavailableDayHandler = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const { employeeid } = req.params;
        const deletedCount = await ShiftsPreferenceAndAvailabillity_1.default.deleteUnavailableDay(Number(employeeid), tenantId);
        if (deletedCount === 0) {
            return res.status(404).json({ message: "Record not found" });
        }
        res.status(200).json({ message: "Record deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteUnavailableDayHandler = deleteUnavailableDayHandler;
