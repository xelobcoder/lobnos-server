"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QCReadingsRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class QCReadingsRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(readingData, trx) {
        try {
            const conn = trx || await this.connection;
            const session = await conn('qc_sessions')
                .where({ id: readingData.sessionId })
                .first();
            if (!session) {
                throw new Error('Invalid session ID: Session must be created before adding readings');
            }
            const [id] = await conn('qc_readings')
                .insert(Object.assign(Object.assign({}, readingData), { createdAt: conn.fn.now() }));
            return id > 0;
        }
        catch (error) {
            console.error('QC reading creation error:', error);
            throw error;
        }
    }
    async update(id, updates) {
        try {
            const conn = await this.connection;
            const result = await conn('qc_readings')
                .where({ id })
                .update(updates);
            return result > 0;
        }
        catch (error) {
            console.error('QC reading update error:', error);
            throw error;
        }
    }
    async findById(id) {
        try {
            const conn = await this.connection;
            return await conn('qc_readings')
                .where({ id })
                .first();
        }
        catch (error) {
            console.error('QC reading find error:', error);
            throw error;
        }
    }
    async findBySessionId(sessionId) {
        try {
            const conn = await this.connection;
            return await conn('qc_readings as qr')
                .leftJoin('control_parameters as cp', 'qr.parameterId', 'cp.id')
                .where({ 'qr.sessionId': sessionId })
                .select('qr.*', 'cp.*')
                .orderBy('qr.createdAt', 'desc');
        }
        catch (error) {
            console.error('QC reading find by session error:', error);
            throw error;
        }
    }
    async findBySessionAndControlId(sessionId, controlId) {
        try {
            const conn = await this.connection;
            return await conn('qc_readings as qr')
                .leftJoin('qc_sessions as qs', 'qr.sessionId', 'qs.id')
                .leftJoin('control_parameters as cp', 'qr.parameterId', 'cp.id')
                .where({
                'qr.sessionId': sessionId,
                'qs.controlMaterialId': controlId
            })
                .select('qr.*', 'cp.*')
                .orderBy('qr.createdAt', 'desc');
        }
        catch (error) {
            console.error('QC reading find by session and control ID error:', error);
            throw error;
        }
    }
    async findByParameter(parameter) {
        try {
            const conn = await this.connection;
            return await conn('qc_readings')
                .where({ parameter })
                .orderBy('createdAt', 'desc');
        }
        catch (error) {
            console.error('QC reading find by parameter error:', error);
            throw error;
        }
    }
    async findByStatus(status) {
        try {
            const conn = await this.connection;
            return await conn('qc_readings')
                .where({ status })
                .orderBy('createdAt', 'desc');
        }
        catch (error) {
            console.error('QC reading find by status error:', error);
            throw error;
        }
    }
    async findAllPaginated(page = 1, limit = 10) {
        try {
            const conn = await this.connection;
            const offset = (page - 1) * limit;
            const [total] = await conn('qc_readings')
                .count('id as count');
            const data = await conn('qc_readings as qr')
                .leftJoin('qc_sessions as qs', 'qr.sessionId', 'qs.id')
                .leftJoin('control_materials as cm', 'qs.controlMaterialId', 'cm.id')
                .leftJoin('roles as r', 'qs.createdby', 'r.employeeid')
                .leftJoin('control_parameters as cp', 'qr.parameterId', 'cp.id')
                .select('qr.*', 'cm.name as control_material_name', 'r.username as created_by_username', 'cp.*')
                .orderBy('qr.createdAt', 'desc')
                .limit(limit)
                .offset(offset);
            return {
                data,
                total: Number(total.count),
                page,
                totalPages: Math.ceil(Number(total.count) / limit)
            };
        }
        catch (error) {
            console.error('QC reading paginated find error:', error);
            throw error;
        }
    }
    async delete(id) {
        try {
            const conn = await this.connection;
            const result = await conn('qc_readings')
                .where({ id })
                .delete();
            return result > 0;
        }
        catch (error) {
            console.error('QC reading delete error:', error);
            throw error;
        }
    }
    async findBatchesBySessionId(sessionId) {
        try {
            const conn = await this.connection;
            return await conn('qc_readings as qr')
                .leftJoin('roles as r', 'qr.createdby', 'r.employeeid')
                .where({ 'qr.sessionId': sessionId })
                .select(conn.raw('DATE(qr.createdAt) as date'), conn.raw('COUNT(DISTINCT qr.parameterId) as count'), 'qr.sessionId', 'r.username as createdBy')
                .groupBy(conn.raw('DATE(qr.createdAt)'), 'qr.sessionId', 'r.username')
                .orderBy('date', 'desc');
        }
        catch (error) {
            console.error('QC reading batch summary error:', error);
            throw error;
        }
    }
}
exports.QCReadingsRepository = QCReadingsRepository;
exports.default = QCReadingsRepository;
