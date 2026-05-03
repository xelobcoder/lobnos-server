"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QCSessionsRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const uuid_1 = require("uuid");
class QCSessionsRepository {
    async getRecentReadingsWithDetails(limit = 10) {
        const conn = await this.connection;
        const readings = await conn('qc_readings as qr')
            .leftJoin('qc_sessions as qs', 'qr.sessionId', 'qs.id')
            .leftJoin('control_parameters as cp', 'qr.parameterId', 'cp.id')
            .leftJoin('control_materials as cm', 'qs.controlMaterialId', 'cm.id')
            .select('qr.*', 'qs.comments as session_comments', 'qs.createdAt as session_createdAt', 'cm.name as control_material_name', 'cm.lotNumber as control_material_lotNumber', 'cm.status as control_material_status', 'cp.parameter as parameter_name', 'cp.value as parameter_value', 'cp.unit as parameter_unit', 'cp.warningLimit', 'cp.actionLimit')
            .orderBy('qr.createdAt', 'desc')
            .limit(limit);
        return readings;
    }
    async getRecentAlertReadings(limit = 10) {
        const conn = await this.connection;
        const alertStatuses = ['critical', 'warning', 'unmonitored'];
        const readings = await conn('qc_readings as qr')
            .leftJoin('qc_sessions as qs', 'qr.sessionId', 'qs.id')
            .leftJoin('control_parameters as cp', 'qr.parameterId', 'cp.id')
            .leftJoin('control_materials as cm', 'qs.controlMaterialId', 'cm.id')
            .select('qr.*', 'qs.comments as session_comments', 'qs.createdAt as session_createdAt', 'cm.name as control_material_name', 'cm.lotNumber as control_material_lotNumber', 'cm.status as control_material_status', 'cp.parameter as parameter_name', 'cp.value as parameter_value', 'cp.unit as parameter_unit', 'cp.warningLimit', 'cp.actionLimit')
            .whereIn('qr.status', alertStatuses)
            .orderBy('qr.createdAt', 'desc')
            .limit(limit);
        return readings;
    }
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(sessionData, trx) {
        try {
            const conn = trx || await this.connection;
            const id = (0, uuid_1.v4)();
            const returned_value = await conn('qc_sessions')
                .insert(Object.assign(Object.assign({}, sessionData), { id }));
            return returned_value[0];
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
    async getDashboardData() {
        const conn = await this.connection;
        const [{ count: totalDevices }] = await conn('devices').count('id as count').catch(() => [{ count: 0 }]);
        const [{ count: activeDevices }] = await conn('devices').where({ status: 'active' }).count('id as count').catch(() => [{ count: 0 }]);
        const [{ count: devicesInMaintenance }] = await conn('devices').where({ status: 'maintenance' }).count('id as count').catch(() => [{ count: 0 }]);
        const today = new Date();
        const [{ count: qcTestsToday }] = await conn('qc_sessions')
            .whereRaw("CAST(createdAt AS DATE) = ?", [today])
            .count('id as count');
        const [{ count: critical }] = await conn('qc_readings')
            .where({ status: 'critical' })
            .count('id as count')
            .catch(() => [{ count: 0 }]);
        const [{ count: unmonitored }] = await conn('qc_readings')
            .where({ status: 'unmonitored' })
            .count('id as count')
            .catch(() => [{ count: 0 }]);
        const [{ count: warning }] = await conn('qc_readings')
            .where({ status: 'warning' })
            .count('id as count')
            .catch(() => [{ count: 0 }]);
        const [{ count: pendingReviews }] = await conn('qc_sessions')
            .where({ status: 'pending_review' })
            .count('id as count')
            .catch(() => [{ count: 0 }]);
        return {
            totalDevices: Number(totalDevices) || 0,
            activeDevices: Number(activeDevices) || 0,
            devicesInMaintenance: Number(devicesInMaintenance) || 0,
            qcTestsToday: Number(qcTestsToday) || 0,
            critical: Number(critical) || 0,
            unmonitored: Number(unmonitored) || 0,
            warning: Number(warning) || 0,
            pendingReviews: Number(pendingReviews) || 0,
        };
    }
}
exports.QCSessionsRepository = QCSessionsRepository;
exports.default = QCSessionsRepository;
