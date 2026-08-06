"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHistory = createHistory;
exports.getHistoryById = getHistoryById;
exports.getHistoryByAscensionId = getHistoryByAscensionId;
exports.updateHistory = updateHistory;
exports.deleteHistory = deleteHistory;
exports.getAllHistories = getAllHistories;
exports.getHistoriesByAscensionIds = getHistoriesByAscensionIds;
exports.upsertHistory = upsertHistory;
const PatientClinicalHistoryUltrasoundRepo_1 = __importDefault(require("../../models/operations/Repositories/PatientClinicalHistoryUltrasoundRepo"));
function getRepository(req) {
    const tenantId = Number(req.query.tenantId);
    if (isNaN(tenantId)) {
        throw new Error('Invalid tenantId in query parameters');
    }
    return new PatientClinicalHistoryUltrasoundRepo_1.default(tenantId);
}
async function createHistory(req, res) {
    try {
        const repository = getRepository(req);
        const historyData = req.body;
        const status = await repository.createHistory(historyData);
        res.status(201).json({ status, message: status ? 'History created successfully' : 'Failed to create history' });
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to create clinical history', error });
    }
}
async function getHistoryById(req, res) {
    try {
        const repository = getRepository(req);
        const { id } = req.params;
        const history = await repository.getHistoryById(Number(id));
        if (!history) {
            return res.status(404).json({ message: 'Clinical history not found' });
        }
        res.json(history);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to retrieve clinical history', error });
    }
}
async function getHistoryByAscensionId(req, res) {
    try {
        const repository = getRepository(req);
        const { ascensionid } = req.params;
        const history = await repository.getHistoryByAscensionId(Number(ascensionid));
        if (!history) {
            return res.status(404).json({ message: 'Clinical history not found' });
        }
        res.json(history);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to retrieve clinical history', error });
    }
}
async function updateHistory(req, res) {
    try {
        const repository = getRepository(req);
        const { id } = req.params;
        const updateData = req.body;
        const affectedRows = await repository.updateHistory(Number(id), updateData);
        if (affectedRows === 0) {
            return res.status(404).json({ message: 'Clinical history not found or no changes made' });
        }
        res.json({ message: 'Clinical history updated successfully' });
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to update clinical history', error });
    }
}
async function deleteHistory(req, res) {
    try {
        const repository = getRepository(req);
        const { id } = req.params;
        const affectedRows = await repository.deleteHistory(Number(id));
        if (affectedRows === 0) {
            return res.status(404).json({ message: 'Clinical history not found' });
        }
        res.json({ message: 'Clinical history deleted successfully' });
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to delete clinical history', error });
    }
}
async function getAllHistories(req, res) {
    try {
        const repository = getRepository(req);
        const histories = await repository.getAllHistories();
        res.json(histories);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to retrieve clinical histories', error });
    }
}
async function getHistoriesByAscensionIds(req, res) {
    try {
        const repository = getRepository(req);
        const { ascensionIds } = req.body;
        if (!Array.isArray(ascensionIds)) {
            return res.status(400).json({ message: 'ascensionIds must be an array' });
        }
        const histories = await repository.getHistoriesByAscensionIds(ascensionIds);
        res.json(histories);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to retrieve clinical histories', error });
    }
}
async function upsertHistory(req, res) {
    try {
        const repository = getRepository(req);
        const { ascensionid, clinical_history } = req.body;
        if (!ascensionid || clinical_history === undefined) {
            return res.status(400).json({ message: 'ascensionid and clinical_history are required' });
        }
        const result = await repository.upsertHistory(Number(ascensionid), clinical_history);
        res.json({ id: result, message: 'Clinical history upserted successfully' });
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('tenantId')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to upsert clinical history', error });
    }
}
