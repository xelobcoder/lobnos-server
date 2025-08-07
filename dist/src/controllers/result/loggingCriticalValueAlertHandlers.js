"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllLoggingCriticalValueAlerts = exports.deleteLoggingCriticalValueAlert = exports.updateLoggingCriticalValueAlert = exports.getLoggingCriticalValueAlertsPaginated = exports.getLoggingCriticalValueAlertById = exports.createLoggingCriticalValueAlert = exports.getCriticalDetails = exports.getPaginatedLoggingCriticalValueAlerts = exports.markLoggingCriticalValueAlertAsSeen = void 0;
const loggingCriticalValueAlertRepository_1 = __importDefault(require("../../models/creator/Repo/loggingCriticalValueAlertRepository"));
const TrackValuesAlertClass_1 = require("../../models/creator/TrackValuesAlertClass");
const markLoggingCriticalValueAlertAsSeen = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const crkeyId = Number(req.params.id);
        const { employeeId } = req.body;
        if (!employeeId) {
            return res.status(400).json({ error: 'employeeId is required in body' });
        }
        const repo = new loggingCriticalValueAlertRepository_1.default(tenantId);
        const updated = await repo.markAsSeen(crkeyId, employeeId);
        res.json({ updated });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to mark alert as seen', details: error.message });
    }
};
exports.markLoggingCriticalValueAlertAsSeen = markLoggingCriticalValueAlertAsSeen;
const getPaginatedLoggingCriticalValueAlerts = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.count) || 10;
        const sortby = req.query.sortby === 'ASC' ? 'ASC' : 'DESC';
        const repo = new loggingCriticalValueAlertRepository_1.default(tenantId);
        const alerts = await repo.findAllPaginated(page, limit, sortby);
        res.json(alerts);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch paginated alerts', details: error.message });
    }
};
exports.getPaginatedLoggingCriticalValueAlerts = getPaginatedLoggingCriticalValueAlerts;
const getCriticalDetails = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const crkeyId = Number(req.params.crKeyId);
        const data = await new TrackValuesAlertClass_1.TrackValuesAlertClass(tenantId).getCriticalDetailsWithAscension(crkeyId);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch critical details', details: error.message });
    }
};
exports.getCriticalDetails = getCriticalDetails;
const createLoggingCriticalValueAlert = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const repo = new loggingCriticalValueAlertRepository_1.default(tenantId);
        const id = await repo.createAlert(req.body);
        res.status(201).json({ id });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create alert', details: error.message });
    }
};
exports.createLoggingCriticalValueAlert = createLoggingCriticalValueAlert;
const getLoggingCriticalValueAlertById = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const repo = new loggingCriticalValueAlertRepository_1.default(tenantId);
        const alert = await repo.findById(Number(req.params.id));
        if (!alert)
            return res.status(404).json({ error: 'Not found' });
        res.json(alert);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch alert', details: error.message });
    }
};
exports.getLoggingCriticalValueAlertById = getLoggingCriticalValueAlertById;
const getLoggingCriticalValueAlertsPaginated = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const repo = new loggingCriticalValueAlertRepository_1.default(tenantId);
        const page = req.query.page ? Number(req.query.page) : 1;
        const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;
        const sortby = req.query.sortby === 'ASC' ? 'ASC' : 'DESC';
        const filters = {
            testid: req.query.testid ? Number(req.query.testid) : undefined,
            ascensionid: req.query.ascensionid ? Number(req.query.ascensionid) : undefined,
            billingid: req.query.billingid ? Number(req.query.billingid) : undefined,
        };
        const result = await repo.findAllPaginated(page, pageSize, sortby, filters);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch paginated alerts', details: error.message });
    }
};
exports.getLoggingCriticalValueAlertsPaginated = getLoggingCriticalValueAlertsPaginated;
const updateLoggingCriticalValueAlert = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const repo = new loggingCriticalValueAlertRepository_1.default(tenantId);
        const updated = await repo.update(Number(req.params.id), req.body);
        res.json({ updated });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update alert', details: error.message });
    }
};
exports.updateLoggingCriticalValueAlert = updateLoggingCriticalValueAlert;
const deleteLoggingCriticalValueAlert = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const repo = new loggingCriticalValueAlertRepository_1.default(tenantId);
        const deleted = await repo.delete(Number(req.params.id));
        res.json({ deleted });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete alert', details: error.message });
    }
};
exports.deleteLoggingCriticalValueAlert = deleteLoggingCriticalValueAlert;
const getAllLoggingCriticalValueAlerts = async (req, res) => {
    try {
        const tenantId = Number(req.query.tenantId);
        const repo = new loggingCriticalValueAlertRepository_1.default(tenantId);
        const alerts = await repo.findAll();
        res.json(alerts);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch alerts', details: err.message });
    }
};
exports.getAllLoggingCriticalValueAlerts = getAllLoggingCriticalValueAlerts;
