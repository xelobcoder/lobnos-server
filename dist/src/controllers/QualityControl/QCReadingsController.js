"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QCReadingsController = void 0;
const QCReadingsRepository_1 = require("../../repositories/QualityControl/QCReadingsRepository");
const QCSessionsRepository_1 = require("../../repositories/QualityControl/QCSessionsRepository");
class QCReadingsController {
    getTenantId(req) {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }
    async createSession(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCSessionsRepository_1.QCSessionsRepository(tenantId);
            const sessionData = req.body;
            const status = await repository.create(sessionData);
            res.status(201).json({ status: typeof status == "number" && status > -1 ? true : false });
        }
        catch (error) {
            console.error('Failed to create QC session:', error);
            res.status(500).json({ error: 'Failed to create QC session' });
        }
    }
    async getSessionById(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCSessionsRepository_1.QCSessionsRepository(tenantId);
            const id = req.params.id;
            const session = await repository.findById(id);
            if (!session) {
                return res.status(404).json({ error: 'QC session not found' });
            }
            res.json(session);
        }
        catch (error) {
            console.error('Failed to fetch QC session:', error);
            res.status(500).json({ error: 'Failed to fetch QC session' });
        }
    }
    async updateSession(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCSessionsRepository_1.QCSessionsRepository(tenantId);
            const id = req.params.id;
            const updates = req.body;
            const result = await repository.update(id, updates);
            res.json({ status: result });
        }
        catch (error) {
            console.error('Failed to update QC session:', error);
            res.status(500).json({ error: 'Failed to update QC session' });
        }
    }
    async deleteSession(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const sessionRepo = new QCSessionsRepository_1.QCSessionsRepository(tenantId);
            const readingRepo = new QCReadingsRepository_1.QCReadingsRepository(tenantId);
            const id = req.params.id;
            // Delete all readings first
            const readings = await readingRepo.findBySessionId(id);
            await Promise.all(readings.map(reading => readingRepo.delete(reading.id)));
            // Then delete the session
            const result = await sessionRepo.delete(id);
            res.json({ status: result });
        }
        catch (error) {
            console.error('Failed to delete QC session:', error);
            res.status(500).json({ error: 'Failed to delete QC session' });
        }
    }
    async getSessionsPaginated(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCSessionsRepository_1.QCSessionsRepository(tenantId);
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const result = await repository.findAllPaginated(page, limit);
            res.json(result);
        }
        catch (error) {
            console.error('Failed to fetch QC sessions:', error);
            res.status(500).json({ error: 'Failed to fetch QC sessions' });
        }
    }
    async create(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository_1.QCReadingsRepository(tenantId);
            const readingData = req.body;
            const status = await repository.create(readingData);
            res.status(201).json({ status });
        }
        catch (error) {
            console.error('Failed to create QC reading:', error);
            res.status(500).json({ error: 'Failed to create QC reading' });
        }
    }
    async deleteBySessionId(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository_1.QCReadingsRepository(tenantId);
            const sessionId = req.params.sessionId;
            const readings = await repository.findBySessionId(sessionId);
            const deletePromises = readings.map(reading => repository.delete(reading.id));
            await Promise.all(deletePromises);
            res.status(200).json({ status: true });
        }
        catch (error) {
            console.error('Failed to delete QC readings:', error);
            res.status(500).json({ error: 'Failed to delete QC readings' });
        }
    }
    async update(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository_1.QCReadingsRepository(tenantId);
            const id = req.params.id;
            const updates = req.body;
            const result = await repository.update(id, updates);
            res.json({ status: result });
        }
        catch (error) {
            console.error('Failed to update QC reading:', error);
            res.status(500).json({ error: 'Failed to update QC reading' });
        }
    }
    async getById(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository_1.QCReadingsRepository(tenantId);
            const id = req.params.id;
            const reading = await repository.findById(id);
            if (!reading) {
                return res.status(404).json({ error: 'QC reading not found' });
            }
            res.json(reading);
        }
        catch (error) {
            console.error('Failed to fetch QC reading:', error);
            res.status(500).json({ error: 'Failed to fetch QC reading' });
        }
    }
    async getBySessionId(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository_1.QCReadingsRepository(tenantId);
            const sessionId = req.params.sessionId;
            const readings = await repository.findBySessionId(sessionId);
            res.json(readings);
        }
        catch (error) {
            console.error('Failed to fetch QC readings:', error);
            res.status(500).json({ error: 'Failed to fetch QC readings' });
        }
    }
    async getBatchesBySessionId(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository_1.QCReadingsRepository(tenantId);
            const sessionId = req.params.sessionId;
            if (!sessionId) {
                return res.status(400).json({ error: 'Session ID is required' });
            }
            const batches = await repository.findBatchesBySessionId(sessionId);
            res.json(batches);
        }
        catch (error) {
            console.error('Failed to fetch QC reading batches:', error);
            res.status(500).json({ error: 'Failed to fetch QC reading batches' });
        }
    }
    async getBySessionAndControlId(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository_1.QCReadingsRepository(tenantId);
            const sessionId = req.params.sessionId;
            const controlId = req.params.controlId;
            console.log({ controlId, sessionId });
            if (!sessionId || !controlId) {
                return res.status(400).json({ error: 'Both sessionId and controlId are required' });
            }
            const readings = await repository.findBySessionAndControlId(sessionId, controlId);
            res.json(readings);
        }
        catch (error) {
            console.error('Failed to fetch QC readings:', error);
            res.status(500).json({ error: 'Failed to fetch QC readings' });
        }
    }
    async getByStatus(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository_1.QCReadingsRepository(tenantId);
            const { status } = req.query;
            if (!status || typeof status !== 'string') {
                return res.status(400).json({ error: 'Status parameter is required' });
            }
            const readings = await repository.findByStatus(status);
            res.json(readings);
        }
        catch (error) {
            console.error('Failed to fetch QC readings:', error);
            res.status(500).json({ error: 'Failed to fetch QC readings' });
        }
    }
    async getPaginated(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new QCReadingsRepository_1.QCReadingsRepository(tenantId);
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const result = await repository.findAllPaginated(page, limit);
            res.json(result);
        }
        catch (error) {
            console.error('Failed to fetch QC readings:', error);
            res.status(500).json({ error: 'Failed to fetch QC readings' });
        }
    }
    async addReadingsToSession(req, res) {
        const tenantId = this.getTenantId(req);
        const readingsRepository = new QCReadingsRepository_1.QCReadingsRepository(tenantId);
        const sessionsRepository = new QCSessionsRepository_1.QCSessionsRepository(tenantId);
        const { sessionId, readings, comments } = req.body;
        if (!sessionId || !Array.isArray(readings) || readings.length === 0) {
            return res.status(400).json({ error: 'Invalid payload: sessionId and non-empty readings array are required' });
        }
        const conn = await readingsRepository.connection;
        const results = [];
        try {
            await conn.transaction(async (trx) => {
                var _a, _b, _c;
                // Create session if not exists
                let session = await sessionsRepository.findById(sessionId);
                if (!session) {
                    const sessionData = {
                        id: sessionId,
                        comments,
                        createdBy: (_a = readings[0]) === null || _a === void 0 ? void 0 : _a.createdby,
                        updatedBy: (_b = readings[0]) === null || _b === void 0 ? void 0 : _b.updatedby,
                        controlMaterialId: (_c = readings[0]) === null || _c === void 0 ? void 0 : _c.controlMaterialId
                    };
                    await sessionsRepository.create(sessionData, trx);
                }
                // Create readings
                for (const readingData of readings) {
                    const readingToCreate = {
                        sessionId,
                        parameter: readingData.parameter,
                        value: readingData.value,
                        parameterId: readingData.parameterId,
                        status: readingData.status,
                        createdby: readingData.createdby,
                        createdAt: readingData.updatedby,
                    };
                    const success = await readingsRepository.create(readingToCreate, trx);
                    results.push(Object.assign(Object.assign({}, readingToCreate), { success }));
                }
            });
            res.status(201).json({ status: true });
        }
        catch (error) {
            console.error('Batch creation failed:', error);
            res.status(500).json({ error: 'Failed to add readings to session' });
        }
    }
}
exports.QCReadingsController = QCReadingsController;
exports.default = QCReadingsController;
