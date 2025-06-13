"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QCSessionsRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class QCSessionsRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(sessionData, trx) {
        try {
            const conn = trx || await this.connection;
            const [id] = await conn('qc_sessions')
                .insert(sessionData);
            return id == 0;
        }
        catch (error) {
            console.error('QC session creation error:', error);
            throw error;
        }
    }
    async findById(id) {
        try {
            const conn = await this.connection;
            return await conn('qc_sessions')
                .where({ id })
                .first();
        }
        catch (error) {
            console.error('QC session find error:', error);
            throw error;
        }
    }
    async findByControlMaterial(controlMaterialId) {
        try {
            const conn = await this.connection;
            return await conn('qc_sessions')
                .where({ controlMaterialId })
                .orderBy('createdAt', 'desc');
        }
        catch (error) {
            console.error('QC session find by control material error:', error);
            throw error;
        }
    }
    async findAllPaginated(page = 1, limit = 10) {
        try {
            const conn = await this.connection;
            const offset = (page - 1) * limit;
            const [total] = await conn('qc_sessions')
                .count('id as count');
            const data = await conn('qc_sessions as qs')
                .leftJoin('control_materials as cm', 'qs.controlMaterialId', 'cm.id')
                .leftJoin('roles as r', 'qs.createdby', 'r.employeeid')
                .select('qs.*', 'cm.name as control_material_name', 'r.username as created_by_username')
                .orderBy('qs.createdAt', 'desc')
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
            console.error('QC session paginated find error:', error);
            throw error;
        }
    }
    async update(id, updates) {
        try {
            const conn = await this.connection;
            const result = await conn('qc_sessions')
                .where({ id })
                .update(updates);
            return result > 0;
        }
        catch (error) {
            console.error('QC session update error:', error);
            throw error;
        }
    }
    async delete(id) {
        try {
            const conn = await this.connection;
            const result = await conn('qc_sessions')
                .where({ id })
                .delete();
            return result > 0;
        }
        catch (error) {
            console.error('QC session delete error:', error);
            throw error;
        }
    }
}
exports.QCSessionsRepository = QCSessionsRepository;
exports.default = QCSessionsRepository;
