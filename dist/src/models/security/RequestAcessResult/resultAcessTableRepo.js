"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class ResultAccessTableRepo {
    static async create(tenantId, request) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const [id] = await connection(this.TABLE_NAME).insert(Object.assign(Object.assign({}, request), { requestedAt: new Date(), status: 'pending' }));
        return id;
    }
    static async findById(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(this.TABLE_NAME).where({ id }).first();
    }
    static async findByPatientId(tenantId, patientid) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(this.TABLE_NAME).where({ patientid });
    }
    static async findByStaffId(tenantId, staffid) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(this.TABLE_NAME).where({ staffid });
    }
    static async findByAscensionId(tenantId, ascensionid) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(this.TABLE_NAME).where({ ascensionid });
    }
    static async findLatestByAscensionAndStaff(tenantId, ascensionid, staffid) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(this.TABLE_NAME)
            .where({ ascensionid, staffid })
            .orderBy('requestedAt', 'desc')
            .first();
    }
    static async findAll(tenantId, query) {
        const { page = 1, count = 20, status } = query || {};
        const connection = await (0, KnexConnections_1.default)(tenantId);
        let q = connection(this.TABLE_NAME).select('*');
        if (status)
            q = q.where({ status });
        return await q.limit(count).offset((page - 1) * count);
    }
    static async update(tenantId, id, updates) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const updated = await connection(this.TABLE_NAME).where({ id }).update(updates);
        return updated > 0;
    }
    static async delete(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const deleted = await connection(this.TABLE_NAME).where({ id }).del();
        return deleted > 0;
    }
    static async grantAccess(tenantId, requestId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const updated = await connection(this.TABLE_NAME).where('id', requestId).update({ status: 'granted', grantedAt: new Date() });
        return updated > 0;
    }
    static async revokeAccess(tenantId, requestId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const updated = await connection(this.TABLE_NAME).where('id', requestId).update({ status: 'revoked', revokedAt: new Date() });
        return updated > 0;
    }
    static async expireAccess(tenantId, requestId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const updated = await connection(this.TABLE_NAME).where('id', requestId).update({ status: 'expired', expiredAt: new Date() });
        return updated > 0;
    }
    static async markAccessUsed(tenantId, requestId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const updated = await connection(this.TABLE_NAME).where('id', requestId).update({ accessedAt: new Date() });
        return updated > 0;
    }
}
ResultAccessTableRepo.TABLE_NAME = 'result_access_requests';
exports.default = ResultAccessTableRepo;
