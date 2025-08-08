"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const logger_1 = __importDefault(require("../../hooks/logger"));
const encryptionModels_1 = require("../../utils/encryptionModels");
class TestResultsAuditLogRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.tableName = 'test_results_audit_log';
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(log) {
        try {
            const conn = await this.connection;
            const [id] = await conn(this.tableName).insert(log);
            return id;
        }
        catch (error) {
            logger_1.default.error('Error creating test results audit log:', error);
            throw error;
        }
    }
    async findById(id) {
        try {
            const conn = await this.connection;
            const result = await conn(this.tableName).where({ id }).first();
            return result || null;
        }
        catch (error) {
            logger_1.default.error('Error finding test results audit log by id:', error);
            throw error;
        }
    }
    async findAllPaginated(page = 1, pageSize = 20, filters) {
        try {
            const conn = await this.connection;
            let baseQuery = conn(this.tableName + ' as t')
                .leftJoin('roles as r', 't.employeeid', 'r.employeeid')
                .select('t.*', 'r.username as employee_name', 'r.role as employee_role', 'r.email as employee_email');
            if (filters) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined) {
                        baseQuery = baseQuery.where(`t.${key}`, value);
                    }
                });
            }
            const totalResultRaw = await baseQuery.clone().count('t.id as count').first();
            const total = totalResultRaw ? Number(totalResultRaw.count) : 0;
            let data = await baseQuery
                .clone()
                .orderBy('t.created_on', 'DESC')
                .limit(pageSize)
                .offset((page - 1) * pageSize);
            data = data.map((row) => {
                if (row.previous_value) {
                    try {
                        row.previous_value = (0, encryptionModels_1.decrypt_value)(row.previous_value);
                    }
                    catch (_a) { }
                }
                if (row.previous_originalvalue) {
                    try {
                        row.previous_originalvalue = (0, encryptionModels_1.decrypt_value)(row.previous_originalvalue);
                    }
                    catch (_b) { }
                }
                return row;
            });
            return { data, total, page, pageSize };
        }
        catch (error) {
            logger_1.default.error('Error fetching paginated test results audit logs:', error);
            throw error;
        }
    }
    async findAll() {
        try {
            const conn = await this.connection;
            return await conn(this.tableName).select('*');
        }
        catch (error) {
            logger_1.default.error('Error fetching all test results audit logs:', error);
            throw error;
        }
    }
    async delete(id) {
        try {
            const conn = await this.connection;
            return await conn(this.tableName).where({ id }).delete();
        }
        catch (error) {
            logger_1.default.error('Error deleting test results audit log:', error);
            throw error;
        }
    }
}
exports.default = TestResultsAuditLogRepository;
