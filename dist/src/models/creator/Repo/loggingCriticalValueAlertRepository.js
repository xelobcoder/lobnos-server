"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const logger_1 = __importDefault(require("../../../hooks/logger"));
class LoggingCriticalValueAlertRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.tableName = 'loggingcriticalvaluealert';
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async findUnseenByBillingId(billingid) {
        try {
            const conn = await this.connection;
            return await conn(this.tableName)
                .where({ billingid })
                .andWhere('isSeen', 0);
        }
        catch (error) {
            logger_1.default.error('Find unseen LoggingCriticalValueAlert by billingid error:', error);
            throw error;
        }
    }
    async markAsSeen(crkeyId, employeeId) {
        try {
            const conn = await this.connection;
            return await conn(this.tableName)
                .where({ crkeyId })
                .update({
                isSeen: 1,
                isSeenBy: employeeId
            });
        }
        catch (error) {
            logger_1.default.error('Error marking alert as seen:', error);
            throw error;
        }
    }
    async createAlert(alertData) {
        try {
            const conn = await this.connection;
            const [result] = await conn(this.tableName)
                .insert({
                billingid: alertData.billingid,
                testid: alertData.testid,
                statement: alertData.statement,
                createdBy: alertData.createdBy,
                isSeen: 0
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('Error creating critical value alert:', error);
            throw error;
        }
    }
    async findAllPaginated(page = 1, pageSize = 20, filters) {
        try {
            const conn = await this.connection;
            let baseQuery = conn(this.tableName)
                .innerJoin('test_panels', `${this.tableName}.testid`, 'test_panels.id')
                .select(`${this.tableName}.*`, 'test_panels.name as testname');
            if (filters) {
                if (filters.testid !== undefined)
                    baseQuery = baseQuery.where('testid', filters.testid);
                if (filters.ascensionid !== undefined)
                    baseQuery = baseQuery.where('ascensionid', filters.ascensionid);
                if (filters.billingid !== undefined)
                    baseQuery = baseQuery.where('billingid', filters.billingid);
            }
            const totalResultRaw = await baseQuery.clone().count('* as count').first();
            const total = totalResultRaw ? Number(totalResultRaw.count) : 0;
            const data = await baseQuery
                .clone()
                .limit(pageSize)
                .offset((page - 1) * pageSize);
            return {
                data,
                total,
                page,
                pageSize
            };
        }
        catch (error) {
            logger_1.default.error('Find all LoggingCriticalValueAlert paginated error:', error);
            throw error;
        }
    }
    async findAll() {
        try {
            const conn = await this.connection;
            return await conn(this.tableName).select('*');
        }
        catch (error) {
            logger_1.default.error('Find all LoggingCriticalValueAlert error:', error);
            throw error;
        }
    }
    async findByTestId(testid) {
        try {
            const conn = await this.connection;
            return await conn(this.tableName)
                .where({ testid })
                .andWhere('isSeen', 0);
        }
        catch (error) {
            logger_1.default.error('Error finding alerts by testid:', error);
            throw error;
        }
    }
    async findById(crkeyId) {
        try {
            const conn = await this.connection;
            const result = await conn(this.tableName)
                .where({ crkeyId })
                .first();
            return result || null;
        }
        catch (error) {
            logger_1.default.error('Error finding alert by crkeyId:', error);
            throw error;
        }
    }
    async update(crkeyId, updateData) {
        try {
            const conn = await this.connection;
            return await conn(this.tableName)
                .where({ crkeyId })
                .update(updateData);
        }
        catch (error) {
            logger_1.default.error('Error updating alert:', error);
            throw error;
        }
    }
    async delete(crkeyId) {
        try {
            const conn = await this.connection;
            return await conn(this.tableName)
                .where({ crkeyId })
                .delete();
        }
        catch (error) {
            logger_1.default.error('Error deleting alert:', error);
            throw error;
        }
    }
}
exports.default = LoggingCriticalValueAlertRepository;
