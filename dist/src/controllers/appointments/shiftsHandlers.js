"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDefaultShiftsHandler = exports.deleteShiftHandler = exports.updateShiftHandler = exports.getShiftByIdHandler = exports.getAllShiftsHandler = exports.createShiftHandler = void 0;
const shfitsServices_1 = __importDefault(require("../../models/appointments/shfitsServices"));
const createShiftHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        const shift = req.body;
        const newShift = await shfitsServices_1.default.createShift(tenantId, shift);
        res.status(201).json(newShift);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createShiftHandler = createShiftHandler;
const getAllShiftsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        const sortby = req.query.sortby === 'ASC' ? 'ASC' : 'DESC';
        const page = req.query.page ? parseInt(req.query.page, 10) : undefined;
        const count = req.query.count ? parseInt(req.query.count, 10) : undefined;
        const shifts = await shfitsServices_1.default.getAllShifts(tenantId, { sortby, count, page });
        res.status(200).json(shifts);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAllShiftsHandler = getAllShiftsHandler;
const getShiftByIdHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        const { id } = req.params;
        const shift = await shfitsServices_1.default.getShiftById(tenantId, Number(id));
        if (!shift) {
            return res.status(404).json({ message: "Shift not found" });
        }
        res.status(200).json(shift);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getShiftByIdHandler = getShiftByIdHandler;
const updateShiftHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        const { id } = req.params;
        const updates = req.body;
        const updatedShift = await shfitsServices_1.default.updateShift(tenantId, Number(id), updates);
        if (!updatedShift) {
            return res.status(404).json({ message: "Shift not found or not updated" });
        }
        res.status(200).json(updatedShift);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateShiftHandler = updateShiftHandler;
const deleteShiftHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        const { id } = req.params;
        const deletedCount = await shfitsServices_1.default.deleteShift(tenantId, Number(id));
        if (deletedCount === 0) {
            return res.status(404).json({ message: "Shift not found" });
        }
        res.status(200).json({ message: "Shift deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteShiftHandler = deleteShiftHandler;
const loadDefaultShiftsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        await shfitsServices_1.default.loadDefaultShifts(tenantId);
        res.status(200).json({ message: "Default shifts loaded" });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.loadDefaultShiftsHandler = loadDefaultShiftsHandler;
